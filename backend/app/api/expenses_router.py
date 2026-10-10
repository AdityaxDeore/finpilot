"""Quick expenses: suggest the item and price from a photo (or a typed name), then save it and learn the price."""
from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core import store
from app.core.auth import resolve_user_id
from app.ocr import parse_receipt, read_text
from app.expenses import vlm
from app.expenses.suggest import item_key, remember, suggest
from app.models import AccountRow, TransactionRow
from app.schemas import AccountType, TxnCategory

router = APIRouter()

_MAX_PHOTO = 6 * 1024 * 1024
_CATEGORIES = {c.value for c in TxnCategory}


class Suggestion(BaseModel):
    item: str | None
    category: str
    price: float | None
    low: float | None
    high: float | None
    source: str  # memory | estimate | receipt | none
    confidence: float
    alternatives: list[str]


async def _photo(file: UploadFile | None) -> bytes | None:
    if file is None:
        return None
    data = await file.read()
    if len(data) > _MAX_PHOTO:
        raise HTTPException(413, "Photo is too large; please use one under 6 MB")
    return data or None


@router.post("/expenses/{user_id}/suggest", response_model=Suggestion)
async def suggest_expense(
    user_id: str = Depends(resolve_user_id),
    photo: UploadFile | None = File(default=None),
    name: str | None = Form(default=None),
    city: str | None = Form(default=None),
) -> dict:
    image = await _photo(photo)
    if not image and not (name and name.strip()):
        raise HTTPException(422, "Send a photo or a name")
    text = read_text(image) if image else ""
    bill = parse_receipt(text)
    if text and not bill["total"]:  # readable text but no total found: let the vision model look at it
        bill = vlm.read_bill(image)
    if bill["total"]:  # a printed bill: its total beats any guess
        return {"item": bill["merchant"], "category": "other", "price": bill["total"], "low": None, "high": None,
                "source": "receipt", "confidence": 1.0, "alternatives": []}
    try:
        out = suggest(user_id, image, name, city)
        if image and out["source"] == "none" and not (name and name.strip()) and (seen := vlm.name_item(image)):
            named = suggest(user_id, None, seen, city)  # the vision model named it: price it by name
            if named["source"] != "none":
                out = named
        return out
    except OSError as e:  # unreadable image
        raise HTTPException(422, "Could not read that photo") from e


def _account(user_id: str) -> AccountRow:
    accounts = store.query(AccountRow, user_id=user_id)
    cash = next((a for a in accounts if a.name.lower() == "cash"), None)
    if cash or accounts:
        return cash or accounts[0]
    cash = AccountRow(user_id=user_id, name="Cash", type=AccountType.checking.value, balance=0)
    store.put(cash)
    return cash


@router.post("/expenses/{user_id}")
async def add_expense(
    user_id: str = Depends(resolve_user_id),
    item: str = Form(...),
    amount: float = Form(...),
    category: str | None = Form(default=None),
    photo: UploadFile | None = File(default=None),
) -> dict:
    name = item.strip()
    if not name or not 0 < amount < 10_000_000:
        raise HTTPException(422, "Enter an item and an amount above zero")
    key = item_key(name)
    if category not in _CATEGORIES:
        category = suggest(user_id, None, key, None)["category"]
    image = await _photo(photo)
    row = TransactionRow(
        user_id=user_id, account_id=_account(user_id).id, date=date.today(), amount=-abs(amount),
        merchant=name.title(), category=category, description="Quick add", review_status="reviewed",
        reviewed_at=datetime.now(timezone.utc),
    )
    store.put(row)
    remember(user_id, key, abs(amount), category, image)
    return {"id": row.id, "item": key, "amount": abs(amount), "category": category}
