"""Gated live web search (Firecrawl). STUB: the web agent replaces the bodies, keeps these signatures."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class WebSource:
    title: str
    url: str
    content: str  # cleaned markdown excerpt, <= ~2500 chars


def gather(message: str, history: list[tuple[str, str]] | None = None) -> list[WebSource]:
    """Decide whether the question needs the live web; if so search+scrape and return up to 3 sources.
    Returns [] when not needed, when FIRECRAWL_API_KEY is unset, or on any failure. Never raises."""
    return []
