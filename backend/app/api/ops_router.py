"""Agent Ops: which keys exist (masked), how each key / model / agent is behaving, what the web agents searched,
and the chain of retries and fallbacks. Secrets never leave the process: only the env-var name and the last 4 characters."""
from __future__ import annotations

import os

from fastapi import APIRouter

from app import telemetry
from app.security import ai_agents

router = APIRouter(prefix="/api/ops", tags=["ops"])

# env var -> (provider, what it is used for)
KEYS = {
    "NVIDIA_API_KEY": ("NVIDIA NIM", "Copilot chat + Evidence Council agents (default)"),
    "NVIDIA_EVIDENCE_API_KEY": ("NVIDIA NIM", "Evidence Council agents (overrides the default key when set)"),
    "NVIDIA_CHAT_API_KEY": ("NVIDIA NIM", "General chat, Risk Council personas, UI translation fallback"),
    "NVIDIA_VISION_API_KEY": ("NVIDIA NIM", "Receipt and photo reading"),
    "NVIDIA_SPEECH_API_KEY": ("NVIDIA NIM", "Speech"),
    "GEMINI_API_KEY": ("Google Gemini", "UI translation (first choice) and photo recognition"),
    "TAVILY_API_KEY": ("Tavily", "Web Intel page and the Web Checker agent"),
    "NUGEN_API_KEY": ("Nugen", "Second opinion and Verdict Writer last resort"),
}
AGENT_TASKS = {
    "data_guardian": "Audit data quality; AI finds wrongly categorised merchants",
    "duplicate_detector": "Judge double-charge candidates",
    "fraud_hunter": "Judge unusually large payments",
    "merchant_verifier": "Content-safety check of merchant names",
    "subscription_sleuth": "Judge price rises and overlaps",
    "pattern_analyst": "Judge payment shapes (bursts, round one-offs)",
    "web_checker": "Search the web about risky merchants, then read the sources",
    "risk_scorer": "Calibrate the final score by at most 10 points",
    "verdict_writer": "Write the plain-language verdict and actions",
}


def _mask(v: str) -> str:
    return f"{v[:5]}…{v[-4:]}" if len(v) > 12 else "set"


@router.get("/overview")
def overview() -> dict:
    stats = telemetry.summary()
    by_key = {b["name"]: b for b in stats["by_key"]}
    by_agent = {b["name"]: b for b in stats["by_agent"]}
    keys = [{"env": env, "provider": prov, "use": use, "configured": bool(os.getenv(env)), "masked": _mask(os.getenv(env, "")) if os.getenv(env) else None,
             "stats": by_key.get(env)} for env, (prov, use) in KEYS.items()]
    agents = [{"agent": a, "task": task, "model": ai_agents.MODELS.get(a), "backup": ai_agents.BACKUPS.get(a), "stats": by_agent.get(a)} for a, task in AGENT_TASKS.items()]
    ev = telemetry.events(300)
    return {
        "keys": keys, "agents": agents, "models": stats["by_model"],
        "totals": {"tokens": stats["tokens"], "fallbacks": stats["fallbacks"], "cache_hits": stats["cache_hits"]},
        "searches": [e for e in ev if e.get("kind") == "search"][:25],
        "events": ev[:120],
    }
