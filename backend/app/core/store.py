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


@lru_cache
def _db():
    # Lazy so pure tests never need credentials or an emulator.
    pid = get_settings().firestore_project_id
    if os.getenv("FIRESTORE_EMULATOR_HOST"):
        return gcf.Client(project=pid)  # anonymous creds, auto-routed to the emulator
    import firebase_admin
    from firebase_admin import credentials, firestore as admin_firestore

    info = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    cred = credentials.Certificate(json.loads(info)) if info else credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"projectId": pid})
    return admin_firestore.client()


def _coll(model):
    return _db().collection(model.__tablename__)


def _q(model, eq):
    q = _coll(model)
    for k, v in eq.items():
        q = q.where(filter=FieldFilter(k, "==", v))
    return q


def get(model, id: str):
    snap = _coll(model).document(id).get()
    return model.model_validate(snap.to_dict()) if snap.exists else None


def query(model, **eq) -> list:
    return [model.model_validate(s.to_dict()) for s in _q(model, eq).stream()]


def first(model, **eq):
    for s in _q(model, eq).limit(1).stream():
        return model.model_validate(s.to_dict())
    return None


def put(*rows) -> None:
    """Upsert rows; split into batches of 500 (atomic per batch, not across them)."""
    for i in range(0, len(rows), _BATCH):
        batch = _db().batch()
        for r in rows[i : i + _BATCH]:
            batch.set(_coll(type(r)).document(r.id), r.model_dump(mode="json"))
        batch.commit()


def delete(model, id: str) -> None:
    _coll(model).document(id).delete()


def delete_where(model, **eq) -> None:
    refs = [s.reference for s in _q(model, eq).stream()]
    for i in range(0, len(refs), _BATCH):
        batch = _db().batch()
        for ref in refs[i : i + _BATCH]:
            batch.delete(ref)
        batch.commit()
