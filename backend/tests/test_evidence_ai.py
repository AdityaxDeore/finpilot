"""Evidence Council AI review: per-agent models, annotation, and silent fallback."""
from types import SimpleNamespace

from app.security import ai_agents


def _f(title="Possible double charge"):
    return {"agent": "duplicate_detector", "severity": "high", "title": title, "detail": "d", "merchant": "X", "amount": 10.0, "txn_ids": ["1"]}


def test_every_ai_agent_has_its_own_model():
    assert len(set(ai_agents.MODELS.values())) == len(ai_agents.MODELS)


def test_notes_attached_per_finding(monkeypatch):
    monkeypatch.setattr(ai_agents, "_key", lambda: "k")
    monkeypatch.setattr(ai_agents, "_post", lambda *a, **k: 'noise {"r":[{"i":0,"v":"doubt","n":"looks like a re-try"}]}')
    out, extra = ai_agents.review("duplicate_detector", [_f()], [])
    assert out[0]["ai"]["verdict"] == "doubt" and extra["ai"] == "ok" and extra["model"] == ai_agents.MODELS["duplicate_detector"]


def test_content_safety_adds_finding_for_unsafe_merchant(monkeypatch):
    monkeypatch.setattr(ai_agents, "_key", lambda: "k")
    monkeypatch.setattr(ai_agents, "_post", lambda m, msgs, *a, **k: "User Safety: unsafe\nSafety Categories: Fraud" if "Scam" in msgs[0]["content"] else "User Safety: safe")
    rows = [SimpleNamespace(merchant=m, amount=-5, description="", id=m) for m in ("Scam Co", "Cafe")]
    out, _ = ai_agents.review("merchant_verifier", [], rows)
    assert [f["merchant"] for f in out] == ["Scam Co"]


def test_model_failure_keeps_rule_findings(monkeypatch):
    monkeypatch.setattr(ai_agents, "_key", lambda: "k")
    def boom(*a, **k): raise RuntimeError("529")
    monkeypatch.setattr(ai_agents, "_post", boom)
    out, extra = ai_agents.review("fraud_hunter", [_f()], [])
    assert len(out) == 1 and "ai" not in out[0] and extra["ai"] == "error"


def test_agents_corroborate_each_other_and_ai_doubt_lowers_score():
    from app.security import agents
    a = {**_f(), "agent": "fraud_hunter", "severity": "medium", "merchant": "Swiggy"}
    b = {**_f(), "agent": "duplicate_detector", "severity": "medium", "merchant": "swiggy"}
    solo = {**_f(), "agent": "pattern_analyst", "severity": "medium", "merchant": "Other"}
    agents.cross_check([a, b, solo])
    assert a["severity"] == "high" and a["corroborated_by"] == ["duplicate_detector"] and "corroborated_by" not in solo and solo["severity"] == "medium"
    assert agents.risk_score([{**solo, "ai": {"verdict": "doubt"}}]) < agents.risk_score([solo])
