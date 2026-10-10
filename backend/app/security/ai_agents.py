"""AI second opinion for the Evidence Council: each agent asks its OWN NVIDIA model (env-overridable) about the rule
findings. The rules stay the source of facts; a model only adds a verdict note, or (content-safety) flags a scam-like
merchant. No key / model error -> the agent's rule findings pass through untouched."""
from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor

import httpx

from app.core.config import get_settings

URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODELS = {  # one model per agent; verdict_writer keeps the copilot model (settings.nvidia_model)
    "duplicate_detector": os.getenv("EVIDENCE_DUPLICATE_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"),
    "fraud_hunter": os.getenv("EVIDENCE_FRAUD_MODEL", "nvidia/nemotron-3-super-120b-a12b"),
    "merchant_verifier": os.getenv("EVIDENCE_MERCHANT_MODEL", "nvidia/nemotron-3.5-content-safety"),
    "subscription_sleuth": os.getenv("EVIDENCE_SUBSCRIPTION_MODEL", "z-ai/glm-5.3-flash"),
    "pattern_analyst": os.getenv("EVIDENCE_PATTERN_MODEL", "openai/gpt-oss-20b"),
}
BACKUPS = {  # tried when the primary model is busy or times out
    "duplicate_detector": "z-ai/glm-5.3-flash",
    "fraud_hunter": "openai/gpt-oss-20b",
    "merchant_verifier": "nvidia/llama-3.1-nemoguard-8b-content-safety",
    "subscription_sleuth": "nvidia/nemotron-3.5-lightning-30b-a3b",
    "pattern_analyst": "nvidia/nemotron-3-super-120b-a12b",
}
_SYSTEM = ("You double-check findings from a personal-finance fraud checker. For each finding decide if it looks genuinely suspicious "
           '("confirm") or probably harmless ("doubt"). You also get what the other agents found so far ("others"); a finding that matches another agent finding on the same merchant is more likely real. Use only the given facts. Reply JSON only: {"r":[{"i":<index>,"v":"confirm"|"doubt","n":"<=14 words"}]}')


def _key() -> str:
    s = get_settings()
    return os.getenv("NVIDIA_EVIDENCE_API_KEY") or s.nvidia_api_key


def _post(model: str, messages: list[dict], max_tokens: int, extra: dict | None = None) -> str:
    r = httpx.post(URL, headers={"Authorization": f"Bearer {_key()}"}, timeout=12,
                   json={"model": model, "messages": messages, "temperature": 0.2, "max_tokens": max_tokens, **(extra or {})})
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"] or ""


def _safety(model: str, text: str) -> bool:
    out = _post(model, [{"role": "user", "content": text}], 60, {"chat_template_kwargs": {"request_categories": "/categories", "enable_thinking": False}})
    return "unsafe" in out.lower().split("safety categories")[0]


def review(agent: str, findings: list[dict], rows, board: list[dict] = ()) -> tuple[list[dict], dict]:
    """(findings with an `ai` note, extra summary fields). Never raises."""
    extra = {"model": MODELS[agent], "ai": "off"}
    if not _key():
        return findings, extra
    for model in (MODELS[agent], BACKUPS[agent]):
        extra["model"] = model
        try:
            return _review(agent, model, findings, rows, board), {**extra, "ai": "ok", "backup": model != MODELS[agent]}
        except Exception as exc:  # noqa: BLE001 - busy/offline/unparseable: try the backup model, then keep the rule result
            extra.update(ai="error", ai_error="busy" if "429" in str(exc) or "529" in str(exc) else "unavailable")
    return findings, {**extra, "model": MODELS[agent]}


def web_evidence(findings: list[dict]) -> tuple[list[dict], dict]:
    """Web Checker agent: asks Tavily about the merchants behind the most serious findings and attaches the answer."""
    from app.api.web_router import _call
    extra = {"model": "tavily", "ai": "off"}
    if not get_settings().tavily_api_key:
        return findings, extra
    merchants = list(dict.fromkeys(f["merchant"] for f in sorted(findings, key=lambda f: (f["severity"] != "high", not f.get("corroborated_by"))) if f["merchant"] and f["severity"] != "low"))[:3]
    extra["ai"] = "ok"
    for m in merchants:
        try:
            r = _call("search", {"query": f"Is {m} a legitimate business or a scam? reviews complaints", "search_depth": "basic", "include_answer": True, "max_results": 3})
        except Exception:  # noqa: BLE001 - rate limit or network: skip this merchant
            extra["ai"] = "error"
            continue
        web = {"answer": (r.get("answer") or "")[:260], "url": (r.get("results") or [{}])[0].get("url", "")}
        for f in findings:
            if f["merchant"] == m:
                f["web"] = web
    return findings, extra


def _review(agent: str, model: str, findings: list[dict], rows, board) -> list[dict]:
    if agent == "merchant_verifier":
        flagged = {f["merchant"] for f in findings}
        seen = {r.merchant: r for r in rows if r.amount < 0 and r.merchant not in flagged}
        names = list(seen)[:12]  # bounded: each check is a model call
        with ThreadPoolExecutor(max_workers=6) as pool:
            bad = [n for n, u in zip(names, pool.map(lambda n: _safety(model, f"Payment to '{n}'. {seen[n].description or ''}"), names)) if u]
        for n in bad:
            r = seen[n]
            findings.append({"agent": agent, "severity": "medium", "title": f"AI safety model flagged '{n}'",
                             "detail": "The content-safety model rated this merchant name or description as unsafe. Verify the merchant before paying again.",
                             "merchant": n, "amount": round(-r.amount, 2), "txn_ids": [r.id],
                             "ai": {"model": model, "verdict": "confirm", "note": "flagged unsafe"}})
    elif findings:
        brief = [{"i": i, "title": f["title"], "detail": f["detail"][:160], "amount": f["amount"]} for i, f in enumerate(findings[:12])]
        content = _post(model, [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": json.dumps({"findings": brief, "others": [[f["agent"], f["title"][:60]] for f in board[:10]]}, ensure_ascii=False)}], 700,
                        {"response_format": {"type": "json_object"}, "chat_template_kwargs": {"enable_thinking": False}})  # thinking mode is too slow for a review
        for item in json.loads(content[content.index("{"):content.rindex("}") + 1])["r"]:
            if 0 <= item["i"] < len(findings) and item["v"] in ("confirm", "doubt"):
                findings[item["i"]]["ai"] = {"model": model, "verdict": item["v"], "note": str(item.get("n", ""))[:120]}
    return findings
