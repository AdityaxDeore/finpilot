"""Web Intel: Tavily search / extract / crawl / map, proxied so the API key never reaches the browser."""
from __future__ import annotations

from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import telemetry
from app.core.config import get_settings
from app.core.ratelimit import RateLimiter

router = APIRouter(prefix="/api/web", tags=["web"])
BASE = "https://api.tavily.com"
_limit = RateLimiter(30, 60)  # one shared key: cap total calls per minute


class Search(BaseModel):
    query: str = Field(min_length=2, max_length=400)
    depth: Literal["basic", "advanced"] = "basic"
    topic: Literal["general", "news", "finance"] = "general"


class Url(BaseModel):
    url: str = Field(min_length=4, max_length=500)


def _call(path: str, payload: dict, agent: str = "web-intel", run: str | None = None) -> dict:
    _limit.check("tavily")
    key = get_settings().tavily_api_key
    if not key:
        raise HTTPException(503, "Tavily is not configured (set TAVILY_API_KEY)")
    t = telemetry.Timer()
    try:
        r = httpx.post(f"{BASE}/{path}", headers={"Authorization": f"Bearer {key}"}, json=payload, timeout=60)
    except httpx.HTTPError as exc:
        telemetry.record(kind="call", provider="tavily", key="TAVILY_API_KEY", model=path, agent=agent, run=run, ok=False, ms=t.ms, error=type(exc).__name__)
        raise HTTPException(502, f"Tavily unreachable: {type(exc).__name__}") from exc
    ok = r.status_code < 400
    body = r.json() if ok else {}
    telemetry.record(kind="call", provider="tavily", key="TAVILY_API_KEY", model=path, agent=agent, run=run, ok=ok, ms=t.ms,
                     tokens=(body.get("usage") or {}).get("credits"), error=None if ok else str(r.status_code))
    if not ok:
        raise HTTPException(502, f"Tavily {r.status_code}: {r.text[:200]}")
    results = body.get("results") or []
    urls = [x if isinstance(x, str) else x.get("url", "") for x in results]
    telemetry.record(kind="search", agent=agent, run=run, op=path, query=payload.get("query") or payload.get("url") or (payload.get("urls") or [""])[0],
                     sites=sorted({u.split("/")[2] for u in urls if u.count("/") >= 2})[:8], results=len(results))
    return body


@router.post("/search")
def search(b: Search) -> dict:
    return _call("search", {"query": b.query, "search_depth": b.depth, "topic": b.topic, "include_answer": True, "max_results": 6})


@router.post("/extract")
def extract(b: Url) -> dict:
    return _call("extract", {"urls": [b.url], "extract_depth": "advanced"})


@router.post("/crawl")
def crawl(b: Url) -> dict:
    return _call("crawl", {"url": b.url, "extract_depth": "advanced", "limit": 8, "max_depth": 1})


@router.post("/map")
def site_map(b: Url) -> dict:
    return _call("map", {"url": b.url, "limit": 40})
