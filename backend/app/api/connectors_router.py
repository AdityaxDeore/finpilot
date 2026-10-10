"""Data connectors: the app starts empty and fills itself when a source is linked.

Google Pay is a *dummy* connector for now: "connecting" generates a realistic
12-month dataset for the user from one of the synthetic personas (the same
generator the demo personas use). Bank / invoice connectors are listed as
coming soon. Swap `_seed_from_persona` for a real adapter later; the routes
and the frontend don't change.
"""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import store
from app.core.auth import DEMO_USER_IDS, resolve_user_id
from app.ingest.personas import PERSONA_CONFIGS, generate_persona
from app.ingest.seed import _clear_user
from app.models import ConnectionRow, InsightsSnapshotRow

router = APIRouter(prefix="/api/connectors", tags=["connectors"])

# id -> (name, description, live?)
CATALOG: dict[str, tuple[str, str, bool]] = {
    "google_pay": ("Google Pay", "UPI payments, merchants and wallet activity", True),
    "bank": ("Bank accounts", "Balances, salary credits, loans and cards", False),
    "invoices": ("Gmail & Drive invoices", "Bills and invoices parsed automatically", False),
    "investments": ("Mutual funds & stocks", "SIPs and holdings from your depository", False),
}

# Which synthetic profile feeds the dummy Google Pay link.
PROFILES = {"priya": "demo-priya", "arjun": "demo-arjun", "meera": "demo-meera"}


class ConnectRequest(BaseModel):
    profile: str = "priya"


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
    stats = _seed_from_persona(user_id, body.profile)
    store.delete_where(InsightsSnapshotRow, user_id=user_id)
    store.put(ConnectionRow(id=f"{user_id}:{connector}", user_id=user_id, connector=connector,
                            detail=body.profile.capitalize(), connected_at=datetime.now(timezone.utc)))
    return {"connected": True, **stats}


@router.delete("/{user_id}/{connector}", status_code=204, response_model=None)
def disconnect(connector: str, user_id: str = Depends(resolve_user_id)) -> None:
    """Unlinking removes everything that source brought in (the app returns to empty)."""
    _guard_not_demo(user_id)
    if connector not in CATALOG:
        raise HTTPException(404, "Unknown connector")
    _clear_user(user_id)
    store.delete_where(InsightsSnapshotRow, user_id=user_id)
    store.delete(ConnectionRow, f"{user_id}:{connector}")
