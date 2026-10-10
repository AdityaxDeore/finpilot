"""Quick expenses: price memory, catalog estimates and the endpoints. CLIP is replaced by deterministic fake vectors,
so these tests check our logic (memory first, then estimate, then ask), not the model."""
from __future__ import annotations

import uuid
import zlib

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.expenses_router import router
from app.core import store
from app.expenses import suggest as sg, vision
from app.models import AccountRow, PriceMemoryRow, TransactionRow

app = FastAPI()
app.include_router(router, prefix="/api")
client = TestClient(app)


def _vec(seed: bytes) -> np.ndarray:
    v = np.random.default_rng(zlib.crc32(seed)).normal(size=512)
    return v / np.linalg.norm(v)


@pytest.fixture(autouse=True)
def fake_clip(monkeypatch):
    # b"text:<words>" photos look exactly like that text to "CLIP"; any other bytes are a unique random picture
    monkeypatch.setattr(vision, "embed_texts", lambda texts: np.array([_vec(t.encode()) for t in texts]))
    monkeypatch.setattr(vision, "embed_image", lambda data: _vec(data[5:]) if data.startswith(b"text:") else _vec(data))
    sg._catalog_vectors.cache_clear()


@pytest.fixture
def uid():
    u = "guest-" + uuid.uuid4().hex[:16]
    yield u
    for m in (PriceMemoryRow, TransactionRow, AccountRow):
        store.delete_where(m, user_id=u)


def _suggest(uid, **kw):
    files = {"photo": ("p.jpg", kw.pop("photo"), "image/jpeg")} if "photo" in kw else None
    r = client.post(f"/api/expenses/{uid}/suggest", data=kw, files=files)
    assert r.status_code == 200, r.text
    return r.json()


def _add(uid, item, amount, photo=None):
    files = {"photo": ("p.jpg", photo, "image/jpeg")} if photo else None
    return client.post(f"/api/expenses/{uid}", data={"item": item, "amount": amount}, files=files)


def test_typed_name_gets_a_catalog_estimate_scaled_by_city(uid):
    base = _suggest(uid, name="chai")
    assert (base["item"], base["price"], base["source"], base["category"]) == ("tea", 15, "estimate", "dining")
    assert (base["low"], base["high"]) == (10, 25)
    assert _suggest(uid, name="Chai", city="Mumbai")["price"] == 18


def test_photo_is_recognised_zero_shot_with_alternatives(uid):
    s = _suggest(uid, photo=b"text:a photo of a cup of tea")
    assert s["item"] == "tea" and s["price"] == 15 and s["confidence"] > 0.9 and len(s["alternatives"]) == 2


def test_unrecognised_photo_leaves_price_blank(uid, monkeypatch):
    monkeypatch.setattr(sg, "MIN_CONFIDENCE", 1.1)
    s = _suggest(uid, photo=b"some random picture")
    assert s["price"] is None and s["source"] == "none"


def test_saved_price_is_suggested_next_time_by_photo_and_by_name(uid):
    photo = b"my own chai stall photo"
    assert _add(uid, "tea", 12, photo).status_code == 200
    by_photo = _suggest(uid, photo=photo)
    assert (by_photo["item"], by_photo["price"], by_photo["source"]) == ("tea", 12, "memory")
    assert _suggest(uid, name="chai")["price"] == 12  # alias maps to the same item, memory beats the catalog


def test_unknown_item_is_learned_from_the_first_entry(uid):
    assert _suggest(uid, name="steel glass")["price"] is None
    _add(uid, "Steel Glass", 40)
    s = _suggest(uid, name="steel glass")
    assert (s["price"], s["source"]) == (40, "memory")


def test_usual_price_is_the_median_of_recent_purchases(uid):
    for p in (10, 10, 20):
        _add(uid, "biscuits", p)
    s = _suggest(uid, name="biscuit")
    assert (s["price"], s["low"], s["high"]) == (10, 10, 20)


def test_add_creates_a_negative_transaction_on_a_cash_account(uid):
    r = _add(uid, "Samosa", 15)
    assert r.status_code == 200 and r.json()["category"] == "dining"
    tx = store.query(TransactionRow, user_id=uid)[0]
    assert tx.amount == -15 and tx.merchant == "Samosa"
    assert store.get(AccountRow, tx.account_id).name == "Cash"


def test_validation(uid):
    assert client.post(f"/api/expenses/{uid}/suggest").status_code == 422
    assert _add(uid, "tea", 0).status_code == 422
    assert _add(uid, "  ", 5).status_code == 422


def test_printed_bill_total_wins_over_a_guess(uid, monkeypatch):
    from app.api import expenses_router as er
    monkeypatch.setattr(er, "read_text", lambda data: "RAJU GENERAL STORE\nRice 5kg Rs 320.00\nSub Total Rs 500.00\nTOTAL Rs 1,518.00")
    s = _suggest(uid, photo=b"any bytes")
    assert (s["item"], s["price"], s["source"]) == ("RAJU GENERAL STORE", 1518.0, "receipt")


def test_vision_model_names_an_item_clip_cannot(uid, monkeypatch):
    from app.api import expenses_router as er
    monkeypatch.setattr(sg, "MIN_CONFIDENCE", 1.1)  # CLIP "never" sure
    def named(data):
        monkeypatch.setattr(sg, "MIN_CONFIDENCE", 0.5)  # a typed/named item is not judged by photo confidence
        return "chai"
    monkeypatch.setattr(er.vlm, "name_item", named)
    s = _suggest(uid, photo=b"blurry cup")
    assert (s["item"], s["source"]) == ("tea", "estimate")
