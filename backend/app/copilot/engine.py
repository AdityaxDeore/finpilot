"""Gemini function-calling copilot engine.

`answer(user_id, message, history=None) -> AnswerContract` is the single
entry point used by /api/chat.

Design notes (see final report for the exact installed google-genai==0.3.0
SDK behaviour this was written against):

  - `google.genai.types.GenerateContentConfig.tools` accepts a list of plain
    Python callables directly (`ToolListUnion = list[Union[Tool, Callable]]`).
    Passing our tool functions there makes the SDK itself perform automatic
    function calling: it introspects each callable's signature/docstring to
    build the FunctionDeclaration, executes it when Gemini requests a call,
    feeds the result back, and repeats -- capped by
    `AutomaticFunctionCallingConfig.maximum_remote_calls`. We rely on this
    instead of hand-rolling the round-trip loop.
  - The Gemini API does not reliably support `tools` + `response_schema` in
    the same call, so this is a two-phase request:
      Phase 1: free-form call with tools enabled -> grounded natural-language
               answer + a full record of every tool call/result made.
      Phase 2: a second, tool-free call that asks the model to compress
               phase 1's grounded findings into strict AnswerContract JSON,
               using `response_schema=AnswerContract`
               (`GenerateContentResponse.parsed` is then already a validated
               `AnswerContract` instance -- the SDK calls
               `AnswerContract.model_validate_json` internally).
  - Any exception anywhere in this module (network, quota, schema
    validation, SDK surprises) falls through to the offline router so
    `/api/chat` never 500s.
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from pydantic import ValidationError

from app.copilot import nugen, offline_router, tools
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

MAX_TOOL_ROUND_TRIPS = 6


# Gemini's Developer API rejects schemas containing free-form dicts (`additionalProperties`),
# and Recommendation.action_params is one. This mirror of AnswerContract omits it; the result
# is re-validated into the real AnswerContract below.
class _GeminiRecommendation(BaseModel):
    action: ActionType
    text: str
    rationale: str
    impact: ImpactEstimate
    confidence: float = Field(ge=0, le=1)


class _GeminiAnswer(BaseModel):
    query: Optional[str] = None
    facts: list[Fact] = Field(default_factory=list)
    predictions: list[Prediction] = Field(default_factory=list)
    recommendations: list[_GeminiRecommendation] = Field(default_factory=list)
    data_gaps: list[DataGap] = Field(default_factory=list)
    narrative: str = ""

_SYSTEM_PROMPT_TOOLS = """You are FinPilot's financial copilot for an Indian retail user.

You have tools to look up the user's real financial data (summary, recurring
obligations, debts, forecast, spending breakdown, invoices, investments) and to simulate the impact of actions
(simulate_action / check_affordability). ALWAYS call the relevant tool(s)
before stating any number. Never invent or guess a number.

Rules:
- Every concrete figure you state (₹ amounts, percentages, dates) must come
  directly from a tool result.
- Statements about the future, or inferred patterns, are predictions, not
  facts -- flag your own confidence in them.
- If you recommend an action, you must call simulate_action or
  check_affordability to get its real impact before recommending it.
- If a tool reports an error or a data gap, say so plainly instead of
  guessing.

First, gather what you need using the tools. Then give a concise,
plain-language answer to the user's question, explicitly separating what you
observed (facts), what you're predicting, and what you'd recommend (with its
simulated impact). Keep it tight -- a few sentences plus any recommendations.
"""

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


def _bound_tool_functions(user_id: str) -> list:
    """Build LLM-facing tool wrappers closed over `user_id` so Gemini never
    has to (and can't) supply/guess a user_id itself. Each wrapper keeps the
    original function's name/docstring for schema generation but drops the
    user_id parameter from the signature Gemini sees."""

    def get_summary() -> dict:
        """Net worth, income, expenses, savings rate, and health score for the current user."""
        return tools.get_summary(user_id)

    def query_transactions(category: str, merchant: str, days: int) -> dict:
        """Look up illustrative recent transactions for the current user,
        over the last `days` days (pass 30 if the user didn't specify).
        `category` and `merchant` are required by this schema -- pass an
        empty string "" for either to mean "no filter" (do NOT omit them)."""
        return tools.query_transactions(user_id, category=category, merchant=merchant, days=days)

    def get_recurring() -> dict:
        """List the current user's recurring obligations (rent, EMI, subscriptions, SIPs)."""
        return tools.get_recurring(user_id)

    def get_debt() -> dict:
        """List the current user's debts and debt-to-income ratio."""
        return tools.get_debt(user_id)

    def get_forecast(horizon_days: int) -> dict:
        """Get the current user's cash-flow forecast for the next
        `horizon_days` days. Pass 90 if the user didn't specify a horizon."""
        return tools.get_forecast(user_id, horizon_days=horizon_days)

    def simulate_action(action: str, action_params: dict) -> dict:
        """Simulate the impact of a financial action (e.g. prepay_debt,
        cancel_subscription, increase_sip, affordability_check) for the
        current user. Returns a real ImpactEstimate-shaped result. Pass {}
        for action_params if the action needs no extra parameters."""
        return tools.simulate_action(user_id, action=action, action_params=action_params or {})

    def check_affordability(amount: float, description: str) -> dict:
        """Check whether the current user can afford a purchase of `amount`
        rupees, with a simulated cash-flow impact. Pass "" for description
        if none is known."""
        return tools.check_affordability(user_id, amount=amount, description=description)

    def get_spending_breakdown(days: int) -> dict:
        """Spend by category, top merchants and monthly totals for the current
        user over the last `days` days (pass 90 if unspecified). Use this for
        any "where does my money go" question."""
        return tools.get_spending_breakdown(user_id, days=days)

    def get_invoices() -> dict:
        """Bills and invoices from the user's Gmail/Drive: paid, due, total due."""
        return tools.get_invoices(user_id)

    def get_investments() -> dict:
        """The user's mutual fund and stock holdings: invested, value, gain, monthly SIPs."""
        return tools.get_investments(user_id)

    return [
        get_summary,
        query_transactions,
        get_recurring,
        get_debt,
        get_forecast,
        simulate_action,
        check_affordability,
        get_spending_breakdown,
        get_invoices,
        get_investments,
    ]


def _history_to_text(history: Optional[list[ChatMessage]]) -> str:
    if not history:
        return ""
    lines = []
    for msg in history[-10:]:
        lines.append(f"{msg.role}: {msg.content}")
    return "\n".join(lines)


def _extract_grounded_findings(response) -> str:
    """Serialize the automatic-function-calling transcript (tool calls +
    results) plus the model's final text into a plain-text block for phase 2."""
    parts_text: list[str] = []
    history = getattr(response, "automatic_function_calling_history", None) or []
    for content in history:
        role = getattr(content, "role", "?")
        for part in getattr(content, "parts", None) or []:
            fc = getattr(part, "function_call", None)
            fr = getattr(part, "function_response", None)
            if fc is not None:
                parts_text.append(f"[{role}] called {fc.name}({json.dumps(fc.args)})")
            elif fr is not None:
                parts_text.append(f"[{role}] {fr.name} returned: {json.dumps(fr.response)}")
            elif getattr(part, "text", None):
                parts_text.append(f"[{role}] {part.text}")
    final_text = response.text or ""
    parts_text.append(f"[final model answer] {final_text}")
    return "\n".join(parts_text)


def _gemini_answer(user_id: str, message: str, history: Optional[list[ChatMessage]]) -> AnswerContract:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=60_000))
    bound_tools = _bound_tool_functions(user_id)

    convo_prefix = _history_to_text(history)
    phase1_contents = (f"Conversation so far:\n{convo_prefix}\n\n" if convo_prefix else "") + (
        f"User question: {message}"
    )

    phase1_config = types.GenerateContentConfig(
        system_instruction=_SYSTEM_PROMPT_TOOLS,
        tools=bound_tools,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            maximum_remote_calls=MAX_TOOL_ROUND_TRIPS
        ),
    )
    response1 = client.models.generate_content(
        model=settings.gemini_model,
        contents=phase1_contents,
        config=phase1_config,
    )
    grounded_findings = _extract_grounded_findings(response1)

    phase2_prompt = (
        f"User question: {message}\n\n"
        f"Grounded findings from tool calls and the model's draft answer:\n{grounded_findings}\n\n"
        "Now produce the strict AnswerContract JSON."
    )
    phase2_config = types.GenerateContentConfig(
        system_instruction=_SYSTEM_PROMPT_STRUCTURE,
        response_mime_type="application/json",
        response_schema=_GeminiAnswer,
    )

    last_error: Optional[Exception] = None
    for attempt in range(2):  # try once, retry once on validation failure
        try:
            response2 = client.models.generate_content(
                model=settings.gemini_model,
                contents=phase2_prompt
                + ("" if attempt == 0 else "\n\nYour previous JSON failed schema validation. Fix it and return ONLY valid JSON."),
                config=phase2_config,
            )
            parsed = response2.parsed
            if isinstance(parsed, _GeminiAnswer):
                parsed = parsed.model_dump(mode="json")
            elif not isinstance(parsed, dict):
                parsed = json.loads(response2.text)
            result = AnswerContract.model_validate(parsed)
            if not result.query:
                result.query = message
            return result
        except ValidationError as exc:
            last_error = exc
            continue
        except Exception as exc:
            last_error = exc
            break

    raise RuntimeError(f"Gemini structured-output phase failed: {last_error}")


def answer(
    user_id: str,
    message: str,
    history: Optional[list[ChatMessage]] = None,
    force_offline: bool = False,
) -> AnswerContract:
    """Answer a user's financial question.

    Uses Gemini when a key is configured (an AI failure is reported as an error
    message, never replaced by a canned answer). The rule-based router is used
    only in offline mode or when no AI key is configured. This
    function is designed to never raise.

    `force_offline`: user-controlled privacy preference (see the Security
    page's "offline mode" toggle) -- when set, financial data never leaves
    this process for a third-party LLM call, regardless of whether a Gemini
    key is configured.
    """
    settings = get_settings()
    # Nugen runs alongside Gemini; never when the user asked for data to stay on this machine.
    pool = ThreadPoolExecutor(max_workers=1)
    second = pool.submit(nugen.second_opinion, user_id, message, history) if settings.has_nugen and not force_offline else None
    result = None
    if settings.has_gemini and not force_offline:
        try:
            result = _gemini_answer(user_id, message, history)
        except Exception as exc:  # noqa: BLE001 - deliberate broad boundary
            # No canned answer when AI is configured: say plainly that it failed.
            logger.warning("Gemini copilot engine failed: %s", exc)
            why = "its quota is used up" if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc) else "it did not respond in time"
            result = AnswerContract(
                query=message,
                narrative=f"The AI assistant couldn't answer right now because {why}. Please try again in a minute.",
                data_gaps=[DataGap(text="Gemini was unavailable.", what_would_help="Retry shortly, or turn on offline mode in Security for basic rule-based answers.")],
            )
    if result is None:  # offline mode, or no AI key configured at all
        result = offline_router.route(user_id, message)
    if second is not None:
        result.nugen_narrative, result.nugen_confidence = second.result()
    pool.shutdown(wait=False)
    return result
