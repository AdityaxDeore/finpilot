"""Account Aggregator flow: consent -> OTP -> encrypted fetch -> mapped rows, with every failure turned into a clear error."""
import pytest
from fastapi.testclient import TestClient

from app.aa import AAError, mapper, mock
from app.core import store
from app.main import app
from app.models import AccountRow, ConnectionRow, TransactionRow

c = TestClient(app)
UID = "guest-aatest00000001"


def _consent(mobile="9876543210", **kw):
    r = c.post(f"/api/aa/{UID}/consent", json={"mobile": mobile, **kw})
    assert r.status_code == 200, r.text
    return r.json()["handle"]


def _active():
    r = c.post(f"/api/aa/{UID}/consent/approve", json={"handle": _consent(), "otp": mock.DEMO_OTP})
    assert r.status_code == 200, r.text
    return r.json()["consent_id"]


def _cleanup():
    from app.ingest.seed import _clear_user
    _clear_user(UID)
    store.delete(ConnectionRow, f"{UID}:google_pay")


def test_full_flow_imports_accounts_and_transactions():
    try:
        r = c.post(f"/api/aa/{UID}/import", json={"consent_id": _active()})
        assert r.status_code == 200 and r.json()["accounts"] == 2 and r.json()["transactions"] > 100
        assert len(store.query(AccountRow, user_id=UID)) == 2
        txns = store.query(TransactionRow, user_id=UID)
        assert any(t.amount < 0 for t in txns) and any(t.amount > 0 for t in txns)
        assert all(t.merchant and "/" not in t.merchant for t in txns)  # merchant parsed out of the UPI narration
        assert store.get(ConnectionRow, f"{UID}:google_pay").detail == "2 accounts via Account Aggregator"
        again = _active()  # linking again replaces, never duplicates
        c.post(f"/api/aa/{UID}/import", json={"consent_id": again})
        assert len(store.query(TransactionRow, user_id=UID)) == len(txns)
    finally:
        _cleanup()


@pytest.mark.parametrize("mobile", ["", "12345", "5876543210", "98765abcde", "98765432101"])
def test_bad_mobile_is_rejected(mobile):
    assert c.post(f"/api/aa/{UID}/consent", json={"mobile": mobile}).status_code == 422


def test_wrong_otp_and_tampered_or_wrong_tokens_are_clear_errors():
    handle = _consent()
    assert c.post(f"/api/aa/{UID}/consent/approve", json={"handle": handle, "otp": "000000"}).status_code == 400
    assert c.post(f"/api/aa/{UID}/consent/approve", json={"handle": handle + "x", "otp": mock.DEMO_OTP}).status_code == 400
    assert c.post(f"/api/aa/{UID}/import", json={"consent_id": handle}).status_code == 400  # a handle is not a consent
    assert c.post(f"/api/aa/{UID}/import", json={"consent_id": "garbage"}).status_code == 400
    assert c.post(f"/api/aa/{UID}/consent", json={"mobile": "9876543210", "months": 99}).status_code == 422
    assert c.post(f"/api/aa/{UID}/consent", json={"mobile": "9876543210", "profile": "nobody"}).status_code == 422


def test_expired_consent_is_410(monkeypatch):
    consent = _active()
    monkeypatch.setattr(mock.time, "time", lambda: 9e12)
    r = c.post(f"/api/aa/{UID}/import", json={"consent_id": consent})
    assert r.status_code == 410 and "expired" in r.json()["detail"]


def test_failed_import_leaves_existing_data_untouched(monkeypatch):
    try:
        c.post(f"/api/aa/{UID}/import", json={"consent_id": _active()})
        before = len(store.query(TransactionRow, user_id=UID))
        monkeypatch.setattr(mock, "decrypt", lambda *a: (_ for _ in ()).throw(AAError("boom", 502)))
        assert c.post(f"/api/aa/{UID}/import", json={"consent_id": _active()}).status_code == 502
        assert len(store.query(TransactionRow, user_id=UID)) == before
    finally:
        _cleanup()


def test_demo_persona_link_never_wipes_fixture():
    base = len(store.query(TransactionRow, user_id="demo-priya"))
    h = c.post("/api/aa/demo-priya/consent", json={"mobile": "9876543210"}).json()["handle"]
    consent = c.post("/api/aa/demo-priya/consent/approve", json={"handle": h, "otp": mock.DEMO_OTP}).json()["consent_id"]
    assert c.post("/api/aa/demo-priya/import", json={"consent_id": consent}).status_code == 200
    assert len(store.query(TransactionRow, user_id="demo-priya")) == base


def test_decrypt_roundtrip_and_wrong_key_fails():
    priv, pub = mock.new_keypair()
    consent = mock.approve(mock.create_consent("9876543210", "priya", 3)["handle"], mock.DEMO_OTP)["consent_id"]
    resp = mock.fetch(consent, pub)
    assert "accounts" in mock.decrypt(priv, resp) and "Priya" not in resp["encryptedFI"]
    other, _ = mock.new_keypair()
    with pytest.raises(AAError):
        mock.decrypt(other, resp)


def test_mapper_rejects_malformed_bank_data():
    with pytest.raises(AAError):
        mapper.to_rows("u", {"accounts": [{"linkedAccRef": "x", "data": {"type": "deposit", "summary": {}}}]})
