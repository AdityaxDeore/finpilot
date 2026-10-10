"""Data connectors: the app starts empty and fills itself when a source is linked.

Google Pay is a *dummy* connector for now: "connecting" generates a realistic
12-month dataset for the user from one of the synthetic personas (the same
generator the demo personas use). Bank / invoice / investment connectors link
demo datasets from backend/data/connectors/. Swap `_seed_from_persona` for a real adapter later; the routes
and the frontend don't change.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core import store
from app.core.auth import DEMO_USER_IDS, resolve_user_id
from app.ingest.personas import PERSONA_CONFIGS, generate_persona
from app.ingest.seed import _clear_user
from app.ingest.upload import parse_transaction_csv
from app.models import AccountRow, ConnectionRow, InsightsSnapshotRow, TransactionRow

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

# id -> (name, description, live?)
CATALOG: dict[str, tuple[str, str, bool]] = {
    "google_pay": ("Google Pay", "UPI payments, merchants and wallet activity", True),
    "bank": ("Bank accounts", "Balances, salary credits, loans and cards", True),
    "google_sheets": ("Google Sheets", "A live expense sheet: edit it and the app updates", True),
    "invoices": ("Gmail & Drive invoices", "Bills and invoices parsed automatically", True),
    "investments": ("Mutual funds & stocks", "SIPs and holdings from your depository", True),
}

# Demo datasets for the non-Google-Pay connectors, all kept in one folder.
DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "connectors"
DATASET_FILES = {"bank": "bank.json", "invoices": "invoices.json", "investments": "investments.json"}


def _dataset(connector: str) -> dict:
    return json.loads((DATA_DIR / DATASET_FILES[connector]).read_text(encoding="utf-8"))


# Which synthetic profile feeds the dummy Google Pay link.
PROFILES = {"priya": "demo-priya", "arjun": "demo-arjun", "meera": "demo-meera"}


class ConnectRequest(BaseModel):
    profile: str = "priya"
    url: str = ""


class Connector(BaseModel):
    id: str
    name: str
    description: str
    available: bool
    connected: bool
    detail: str | None = None
    connected_at: datetime | None = None


def _guard_not_demo(user_id: str) -> None:
    if user_id in DEMO_USER_IDS:
        raise HTTPException(400, "Demo personas are fixed fixtures and can't be re-linked")


def _seed_from_persona(user_id: str, profile: str) -> dict[str, int]:
    source = PROFILES.get(profile)
    if source is None:
        raise HTTPException(422, f"Unknown profile '{profile}'")
    _clear_user(user_id)
    data = generate_persona(replace(PERSONA_CONFIGS[source], user_id=user_id))
    store.put(*data.accounts, *data.transactions, *data.debts, *data.incomes,
              *data.rules, *data.budgets, *data.goals)
    return {"accounts": len(data.accounts), "transactions": len(data.transactions)}


_SHEET_RE = re.compile(r"^https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)")


def _sheet_csv_url(url: str) -> str:
    """Only docs.google.com sheet links are accepted (the backend fetches this URL, so no arbitrary hosts)."""
    m = _SHEET_RE.match(url.strip())
    if not m:
        raise HTTPException(422, "Paste a Google Sheets link that starts with https://docs.google.com/spreadsheets/d/")
    gid = re.search(r"[#&?]gid=(\d+)", url)
    return f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv&gid={gid.group(1) if gid else 0}"


def _sync_sheet(user_id: str, csv_url: str, last_hash: str | None = None) -> tuple[bool, str, int]:
    """Fetch the sheet, and replace the user's ledger with it when it changed. Returns (changed, hash, rows)."""
    try:
        r = httpx.get(csv_url, follow_redirects=True, timeout=20)
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Couldn't read the sheet. In Google Sheets choose Share, then 'Anyone with the link' can view.") from exc
    if "text/csv" not in r.headers.get("content-type", ""):
        raise HTTPException(502, "That link isn't readable as a CSV. Set sharing to 'Anyone with the link' can view.")
    digest = hashlib.sha256(r.content).hexdigest()
    if digest == last_hash:
        return False, digest, 0
    try:
        txns = parse_transaction_csv(r.content, user_id=user_id, account_id=f"{user_id}-sheet")
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    _clear_user(user_id)
    # balance = everything that came in minus everything that went out, so it can't go negative unless spending beats income
    store.put(AccountRow(id=f"{user_id}-sheet", user_id=user_id, name="Google Sheet", type="checking", balance=round(sum(t.amount for t in txns), 2)), *txns)
    store.delete_where(InsightsSnapshotRow, user_id=user_id)
    return True, digest, len(txns)


@router.get("/{user_id}", response_model=list[Connector])
def list_connectors(user_id: str = Depends(resolve_user_id)) -> list[Connector]:
    linked = {c.connector: c for c in store.query(ConnectionRow, user_id=user_id)}
    out = []
    for cid, (name, desc, live) in CATALOG.items():
        row = linked.get(cid)
        out.append(Connector(id=cid, name=name, description=desc, available=live,
                             connected=row is not None and row.status == "connected",
                             detail=row.detail if row else None,
                             connected_at=row.connected_at if row else None))
    return out


@router.post("/{user_id}/{connector}/connect")
def connect(connector: str, body: ConnectRequest, user_id: str = Depends(resolve_user_id)) -> dict:
    _guard_not_demo(user_id)
    if connector not in CATALOG:
        raise HTTPException(404, "Unknown connector")
    if not CATALOG[connector][2]:
        raise HTTPException(409, f"{CATALOG[connector][0]} isn't available yet")
    if connector == "google_sheets":
        csv_url = _sheet_csv_url(body.url)
        _, digest, n = _sync_sheet(user_id, csv_url)
        store.put(ConnectionRow(id=f"{user_id}:{connector}", user_id=user_id, connector=connector, detail=f"{n} rows, live",
                                source_url=csv_url, content_hash=digest, connected_at=datetime.now(timezone.utc)))
        return {"connected": True, "transactions": n}
    if connector == "google_pay":
        stats = _seed_from_persona(user_id, body.profile)
        detail = body.profile.capitalize()
    else:
        # shortcut: dataset-only link (doesn't touch dashboard data), upgrade when a real adapter lands
        stats = {k: len(v) for k, v in _dataset(connector).items()}
        detail = f"{sum(stats.values())} records"
    store.delete_where(InsightsSnapshotRow, user_id=user_id)
    store.put(ConnectionRow(id=f"{user_id}:{connector}", user_id=user_id, connector=connector,
                            detail=detail, connected_at=datetime.now(timezone.utc)))
    return {"connected": True, **stats}


@router.post("/{user_id}/google_sheets/sync")
def sync_sheet(user_id: str = Depends(resolve_user_id)) -> dict:
    """Re-read the linked sheet; the ledger is only replaced when the sheet changed."""
    row = store.get(ConnectionRow, f"{user_id}:google_sheets")
    if row is None or not row.source_url:
        raise HTTPException(409, "Google Sheets isn't connected")
    changed, digest, n = _sync_sheet(user_id, row.source_url, row.content_hash)
    if changed:
        row.content_hash, row.detail = digest, f"{n} rows, live"
        store.put(row)
    return {"changed": changed}


@router.get("/{user_id}/{connector}/export")
def export(connector: str, user_id: str = Depends(resolve_user_id)) -> JSONResponse:
    """Download what a connector brought in, as a JSON file."""
    if connector not in CATALOG:
        raise HTTPException(404, "Unknown connector")
    if store.get(ConnectionRow, f"{user_id}:{connector}") is None:
        raise HTTPException(409, f"{CATALOG[connector][0]} isn't connected")
    if connector in ("google_pay", "google_sheets"):
        data = {"transactions": [t.model_dump(mode="json") for t in store.query(TransactionRow, user_id=user_id)]}
    else:
        data = _dataset(connector)
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="{connector}.json"'})


@router.delete("/{user_id}/{connector}", status_code=204, response_model=None)
def disconnect(connector: str, user_id: str = Depends(resolve_user_id)) -> None:
    """Unlinking removes everything that source brought in (the app returns to empty)."""
    _guard_not_demo(user_id)
    if connector not in CATALOG:
        raise HTTPException(404, "Unknown connector")
    _clear_user(user_id)
    store.delete_where(InsightsSnapshotRow, user_id=user_id)
    store.delete(ConnectionRow, f"{user_id}:{connector}")
