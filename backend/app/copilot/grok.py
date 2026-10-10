"""xAI Grok client for the copilot (OpenAI-compatible chat completions).

Grok gets the same pre-fetched, real numbers Nugen gets and must answer with the
AnswerContract JSON. Unlike nugen.py this RAISES on failure so engine.answer can
fall back to Gemini.
"""
from __future__ import annotations

import json

import httpx

from app.core.config import get_settings

URL = "https://api.x.ai/v1/chat/completions"


def complete_json(system: str, user: str) -> dict:
    s = get_settings()
    r = httpx.post(
        URL,
        headers={"Authorization": f"Bearer {s.xai_api_key}"},
        json={
            "model": s.xai_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=60,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"xAI {r.status_code}: {r.text[:300]}")
    return json.loads(r.json()["choices"][0]["message"]["content"])
