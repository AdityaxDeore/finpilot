"""Firestore access for the SQLModel row classes in app.models.

Collection = Model.__tablename__, document id = row.id. Rows are stored as
JSON-mode dicts (ISO date strings), so reads go through model_validate -- never
Model(**d), which doesn't coerce types on table=True models.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

from google.cloud import firestore as gcf
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.config import get_settings

_BATCH = 500
_LOCAL_FALLBACK = False
_MEMORY_STORE: dict[str, dict[str, dict]] = {}


@lru_cache
def _db():
    # Lazy so pure tests never need credentials or an emulator.
    global _LOCAL_FALLBACK
    pid = get_settings().firestore_project_id
    if os.getenv("FIRESTORE_EMULATOR_HOST"):
        return gcf.Client(project=pid)  # anonymous creds, auto-routed to the emulator
    import firebase_admin
    from firebase_admin import credentials, firestore as admin_firestore

    info = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    try:
        cred = credentials.Certificate(json.loads(info)) if info else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {"projectId": pid})
        return admin_firestore.client()
    except Exception as exc:
        # Graceful fallback for local development without Google Cloud ADC/credentials
        print(f"[store] Firestore credentials not configured ({exc}). Using in-memory fallback store.")
        _LOCAL_FALLBACK = True
        return None


def _coll(model):
    client = _db()
    return client.collection(model.__tablename__) if client else None


def _q(model, eq):
    q = _coll(model)
    for k, v in eq.items():
        q = q.where(filter=FieldFilter(k, "==", v))
    return q


def get(model, id: str):
    if _db() is None or _LOCAL_FALLBACK:
        table = _MEMORY_STORE.get(model.__tablename__, {})
        doc = table.get(id)
        return model.model_validate(doc) if doc else None
    snap = _coll(model).document(id).get()
    return model.model_validate(snap.to_dict()) if snap.exists else None


def query(model, **eq) -> list:
    if _db() is None or _LOCAL_FALLBACK:
        table = _MEMORY_STORE.get(model.__tablename__, {})
        res = []
        for doc in table.values():
            if all(doc.get(k) == v for k, v in eq.items()):
                res.append(model.model_validate(doc))
        return res
    return [model.model_validate(s.to_dict()) for s in _q(model, eq).stream()]


def first(model, **eq):
    if _db() is None or _LOCAL_FALLBACK:
        results = query(model, **eq)
        return results[0] if results else None
    for s in _q(model, eq).limit(1).stream():
        return model.model_validate(s.to_dict())
    return None


def put(*rows) -> None:
    """Upsert rows; split into batches of 500 (atomic per batch, not across them)."""
    if _db() is None or _LOCAL_FALLBACK:
        for r in rows:
            tbl = _MEMORY_STORE.setdefault(type(r).__tablename__, {})
            tbl[r.id] = r.model_dump(mode="json")
        return

    for i in range(0, len(rows), _BATCH):
        batch = _db().batch()
        for r in rows[i : i + _BATCH]:
            batch.set(_coll(type(r)).document(r.id), r.model_dump(mode="json"))
        batch.commit()


def delete(model, id: str) -> None:
    if _db() is None or _LOCAL_FALLBACK:
        tbl = _MEMORY_STORE.get(model.__tablename__, {})
        tbl.pop(id, None)
        return
    _coll(model).document(id).delete()


def delete_where(model, **eq) -> None:
    if _db() is None or _LOCAL_FALLBACK:
        tbl = _MEMORY_STORE.get(model.__tablename__, {})
        to_del = [id for id, doc in tbl.items() if all(doc.get(k) == v for k, v in eq.items())]
        for id in to_del:
            tbl.pop(id, None)
        return

    refs = [s.reference for s in _q(model, eq).stream()]
    for i in range(0, len(refs), _BATCH):
        batch = _db().batch()
        for ref in refs[i : i + _BATCH]:
            batch.delete(ref)
        batch.commit()
