"""RAG over the user's own data + uploaded documents. STUB: the rag agent replaces the bodies, keeps these signatures."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Chunk:
    id: str
    kind: str  # "transaction_summary" | "debt" | "goal" | "budget" | "income" | "account" | "recurring" | "document" | "scheme"
    text: str  # self-contained sentence(s) the LLM can quote
    score: float  # fused retrieval score, higher is better
    label: str  # short human label shown in the UI, e.g. "Statement.pdf" or "Dining, Sep 2026"


def retrieve(user_id: str, query: str, k: int = 8) -> list[Chunk]:
    """Top-k chunks for this user and question. Must never raise (return [] on any failure)."""
    return []
