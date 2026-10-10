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


class Scheme(BaseModel):
    scheme: str = Field(min_length=2, max_length=200)
    question: str = Field(default="", max_length=300)


_OFFICIAL = ["gov.in", "nic.in", "rbi.org.in", "sebi.gov.in", "indiapost.gov.in", "nsiindia.gov.in", "npscra.nsdl.co.in", "epfindia.gov.in", "jansuraksha.gov.in", "pmjdy.gov.in"]
_ANALYST = ("You are a careful analyst of Indian government savings, pension, insurance and tax schemes. Use ONLY the numbered sources given; "
            "if they do not say something, write 'not stated in the sources'. Never invent rates, dates or limits. Reply JSON only: "
            '{"summary": "2-3 sentences", "eligibility": [..], "benefits": [..], "how_to_apply": [..], "deadlines": [..], "watch_out": [..]} '
            "with short plain-language strings (max 5 each) and add the source number like [2] at the end of each fact.")


@router.post("/scheme-analyst")
def scheme_analyst(b: Scheme) -> dict:
    """Deep (advanced) Tavily search limited to official sites, then an NVIDIA model writes a sourced brief."""
    q = f"{b.scheme} India government scheme {b.question}".strip()
    res = _call("search", {"query": q, "search_depth": "advanced", "include_answer": "advanced", "include_domains": _OFFICIAL, "max_results": 6},
                agent="scheme-analyst")
    sources = [{"n": i + 1, "title": r.get("title") or r["url"], "url": r["url"]} for i, r in enumerate(res.get("results", []))]
    if not sources:  # official sites had nothing: say so rather than analysing the open web
        return {"scheme": b.scheme, "brief": None, "answer": res.get("answer"), "sources": [], "note": "No official source found for this scheme."}
    from app.copilot import nvidia
    material = "\n\n".join(f"[{i + 1}] {r.get('title', '')}\n{(r.get('content') or '')[:1200]}" for i, r in enumerate(res["results"]))
    try:
        brief = nvidia.complete_json(_ANALYST, f"Scheme: {b.scheme}\nQuestion: {b.question or 'Overview'}\n\nSources:\n{material}")
    except Exception:  # noqa: BLE001 - model busy: fall back to Tavily's own answer
        brief = None
    return {"scheme": b.scheme, "brief": brief, "answer": res.get("answer"), "sources": sources}
