"""Copilot engine: NVIDIA-hosted models only.

`answer(user_id, message, history, force_offline, model) -> AnswerContract` is the single entry point used by
/api/chat. Money questions go to the deep model with the user's real numbers; small talk goes to the fast chat model.
Identity questions are answered locally. Offline mode uses the rule-based router and sends nothing anywhere.
"""
import json
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from app.copilot import nugen, nvidia, offline_router
from app.core.config import get_settings
from pydantic import BaseModel, Field

from app.schemas import (
    ActionType,
    AnswerContract,
    ChatMessage,
    DataGap,
    Fact,
    ImpactEstimate,
    Prediction,
)

logger = logging.getLogger(__name__)



# Mirror of AnswerContract without the free-form `action_params` dict, so the schema we show the model stays simple.
# The result is re-validated into the real AnswerContract.
class _RecommendationSchema(BaseModel):
    action: ActionType
    text: str
    rationale: str
    impact: ImpactEstimate
    confidence: float = Field(ge=0, le=1)


class _AnswerSchema(BaseModel):
    query: Optional[str] = None
    facts: list[Fact] = Field(default_factory=list)
    predictions: list[Prediction] = Field(default_factory=list)
    recommendations: list[_RecommendationSchema] = Field(default_factory=list)
    data_gaps: list[DataGap] = Field(default_factory=list)
    narrative: str = ""

_SYSTEM_PROMPT_STRUCTURE = """You convert a financial copilot's grounded findings into strict JSON matching
the AnswerContract schema.

Hard rules:
- Only include a number in `facts` or `predictions.value` if it appears in
  the grounded findings below (which come from real tool calls) -- never
  invent one.
- `predictions` are for speculative/future statements only, each with a
  `confidence` (0-1) and a `basis` string explaining what it's derived from.
- `recommendations[].impact` must be populated from an actual
  `simulate_action`/`check_affordability` tool result in the grounded
  findings -- never invent an impact. If no simulation was run for a
  recommendation you want to make, omit that recommendation instead.
- If something the user asked about could not be answered from the grounded
  findings, add a `data_gaps` entry describing what's missing instead of
  guessing.
- `narrative` is a short natural-language summary tying it together.

Return ONLY the JSON object, nothing else.
"""


def _history_to_text(history: Optional[list[ChatMessage]]) -> str:
    if not history:
        return ""
    lines = []
    for msg in history[-10:]:
        lines.append(f"{msg.role}: {msg.content}")
    return "\n".join(lines)



_IDENTITY = re.compile(
    r"who are you|what are you|your name|which (ai |llm |language )?model|what (ai |llm |language )?model|are you (chat ?gpt|gpt|gemini|grok|claude|llama|nemotron|nvidia|an? ai|a bot|a robot)|"
    r"who (made|built|created|trained|developed) you|(which|what) company|powered by|underlying model|\bllm\b",
    re.I,
)
_IDENTITY_REPLY = (
    "I'm FinPilot, your personal finance copilot. I look at your own money data, explain it in plain words, "
    "and keep you posted on deadlines and schemes. Ask me anything about your money."
)

_FINANCE = re.compile(
    r"₹|scheme|yojana|deadline|due date|ppf|nps|elss|80c|itr|advance tax|gold bond|rupee|rs|spend|spent|expens|income|salary|earn|debt|loan|emi|sip|subscri|saving|budget|forecast|invoice|bill|invest|mutual|stock|"
    r"transaction|cash|afford|balance|net worth|tax|goal|credit|card|rent|insurance|health score|emergency fund|cancel|prepay|my (money|account|finance)",
    re.I,
)

_GENERAL_SYSTEM = (
    "You are FinPilot's friendly assistant inside a personal-finance app. Chat naturally and be concise. "
    "You have NO access to the user's accounts in this reply, so never state their balances or spending. "
    "If they want numbers about their money, invite them to ask a specific money question."
    + " Your name is FinPilot. If asked who or what you are, or which model, company or technology is behind you, say only that you are FinPilot, a personal finance copilot; never name any AI model, vendor or provider."
)


def _is_general(message: str) -> bool:
    """Small talk and non-money questions go to the fast chat model; money questions get grounded data."""
    return not _FINANCE.search(message)


def _general_answer(message: str, history: Optional[list[ChatMessage]], user_id: Optional[str] = None) -> AnswerContract:
    """Fast chat model. With `user_id` it also gets the user's real numbers to answer money questions."""
    turns = [(m.role, m.content) for m in (history or []) if m.role in ("user", "assistant")]
    system = _GENERAL_SYSTEM + (("\n\nDATA (answer only from this, quote amounts exactly):\n" + json.dumps(nugen._context(user_id), default=str)) if user_id else "")
    return AnswerContract(query=message, narrative=nvidia.chat(message, turns, system), source="FinPilot")


def _nvidia_answer(user_id: str, message: str, history: Optional[list[ChatMessage]]) -> AnswerContract:
    """One NVIDIA call over the real, pre-fetched numbers (no recommendations: those need a simulation)."""
    convo = _history_to_text(history)
    user = (
        (f"Conversation so far:\n{convo}\n\n" if convo else "")
        + f"User question: {message}\n\nGrounded findings (real data, JSON):\n{json.dumps(nugen._context(user_id), default=str)}\n\n"
        "Produce the strict AnswerContract JSON. Leave `recommendations` empty. Use EXACTLY this JSON schema:\n"
        f"{json.dumps(_AnswerSchema.model_json_schema())}\n"
        'Example fact: {"text": "Monthly income is ₹94,431", "value": 94431, "source_txn_ids": []}. '
        "`text` is a full sentence and `value` is a plain number or null. Write `narrative` as 2 to 4 friendly plain sentences."
    )
    result = AnswerContract.model_validate(_AnswerSchema.model_validate(nvidia.complete_json(_SYSTEM_PROMPT_STRUCTURE, user)).model_dump(mode="json"))
    if not result.query:
        result.query = message
    return result


def answer(
    user_id: str,
    message: str,
    history: Optional[list[ChatMessage]] = None,
    force_offline: bool = False,
    model: str = "auto",
) -> AnswerContract:
    """Answer a user's question. Never raises.

    `model`: auto = money questions get the deep, number-checking engine and everything else the fast chat engine
    (each tries the other if it fails); deep = always the deep engine; fast = always the fast engine (given your data
    for money questions). An AI failure is reported honestly, never replaced by a canned answer. The rule-based
    router answers only in offline mode (`force_offline`: data never leaves this process) or when no key is set.
    """
    settings = get_settings()
    if _IDENTITY.search(message):
        return AnswerContract(query=message, narrative=_IDENTITY_REPLY, source="FinPilot")
    if force_offline or not (settings.has_nvidia or settings.nvidia_chat_api_key):
        result = offline_router.route(user_id, message)
        result.source = "FinPilot rules"
        return result

    # a short follow-up ("and last month?") inherits the topic of the previous user turn
    prior = next((m.content for m in reversed(history or []) if m.role == "user"), "")
    money = not _is_general(message) or (len(message) < 40 and not _is_general(prior))
    deep = lambda: _nvidia_answer(user_id, message, history)  # noqa: E731
    fast = lambda: _general_answer(message, history, user_id if money else None)  # noqa: E731
    steps = [fast, deep] if model == "fast" or (model == "auto" and not money) else [deep, fast]

    # Nugen's second opinion runs alongside money questions only
    pool = ThreadPoolExecutor(max_workers=1)
    second = pool.submit(nugen.second_opinion, user_id, message, history) if money and settings.has_nugen else None
    result, last = None, None
    for step in steps:
        try:
            result = step()
            result.source = "FinPilot"
            break
        except Exception as exc:  # noqa: BLE001 - deliberate broad boundary
            last = exc
            logger.warning("Copilot engine step failed: %s", exc)
    if result is None:
        why = "it is busy right now" if "429" in str(last) else "it did not respond in time"
        result = AnswerContract(
            query=message,
            narrative=f"I couldn't answer right now because {why}. Please try again in a minute.",
            data_gaps=[DataGap(text="The AI engine was unavailable.", what_would_help="Retry shortly, or turn on 'Keep my data on this device' for basic rule-based answers.")],
        )
    if second is not None:
        result.nugen_narrative, result.nugen_confidence = second.result()
    pool.shutdown(wait=False)
    return result
