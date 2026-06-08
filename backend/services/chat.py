"""
AI chat service: dynamic Pydantic AI agent over all FlashAlpha REST endpoints.
Ported from backend/flashalpha_agent.py with proper imports, streaming, and error handling.
"""

import json
import logging
from datetime import date
from typing import Any, AsyncIterator, Optional

logger = logging.getLogger(__name__)

import httpx
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelRequest, ModelResponse, UserPromptPart, TextPart
from pydantic_ai.agent import ModelRequestNode, CallToolsNode
from pydantic_ai.messages import FunctionToolCallEvent, PartDeltaEvent, TextPartDelta
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from pydantic_graph import End

from backend.config import settings

# ─── FlashAlpha base URL (bare host — spec paths include their own /v1 prefixes)
FLASHALPHA_BASE = "https://lab.flashalpha.com"

# ─── All 16 FlashAlpha endpoints as data (dynamic tool builder generates @agent.tool per entry)
ENDPOINT_SPEC: list[dict] = [
    {
        "name": "get_stock_quote",
        "description": "Get live bid/ask/mid/last price for a stock or ETF symbol.",
        "path": "/stockquote/{symbol}",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_stock_summary",
        "description": (
            "Comprehensive stock summary: price, ATM IV, HV, VRP, skew, term structure, "
            "options flow, GEX/DEX/VEX/CHEX exposure, macro context (VIX, VVIX, SKEW)."
        ),
        "path": "/v1/stock/{symbol}/summary",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_gex",
        "description": (
            "Gamma exposure (GEX) by strike for a symbol. "
            "Includes call/put GEX, OI, volume, and net GEX. "
            "Optionally filter by a single expiration date."
        ),
        "path": "/v1/exposure/gex/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["expiration", "min_oi"],
    },
    {
        "name": "get_key_levels",
        "description": (
            "Key options-derived levels: gamma flip, call wall, put wall, "
            "max positive/negative gamma strikes, highest OI strike, 0DTE magnet."
        ),
        "path": "/v1/exposure/levels/{symbol}",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_exposure_summary",
        "description": (
            "Full exposure summary: net GEX/DEX/VEX/CHEX totals, gamma regime, "
            "dealer hedging estimates for ±1% spot moves, 0DTE contribution."
        ),
        "path": "/v1/exposure/summary/{symbol}",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_narrative",
        "description": (
            "Verbal narrative analysis of options exposure: regime, GEX change, "
            "key levels, flow, vanna/charm interpretation, and market outlook."
        ),
        "path": "/v1/exposure/narrative/{symbol}",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_zero_dte",
        "description": (
            "Real-time 0DTE analytics: gamma regime, expected move, pin risk score, "
            "dealer hedging at ±0.5/1%, theta acceleration, vol context, flow."
        ),
        "path": "/v1/exposure/zero-dte/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["strike_range"],
    },
    {
        "name": "get_max_pain",
        "description": (
            "Max pain analysis: strike where total option holder payout is minimized, "
            "pain curve, OI breakdown, dealer alignment, pin probability."
        ),
        "path": "/v1/maxpain/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["expiration"],
    },
    {
        "name": "get_bsm_greeks",
        "description": (
            "Compute full Black-Scholes-Merton greeks from inputs. "
            "Returns delta, gamma, theta, vega, rho + second/third order greeks."
        ),
        "path": "/v1/pricing/greeks",
        "path_params": [],
        "query_params": ["spot", "strike", "dte", "sigma", "type", "r", "q"],
    },
    {
        "name": "get_implied_vol",
        "description": "Compute implied volatility from a market option price using Newton-Raphson.",
        "path": "/v1/pricing/iv",
        "path_params": [],
        "query_params": ["spot", "strike", "dte", "price", "type", "r", "q"],
    },
    {
        "name": "get_volatility_analysis",
        "description": (
            "Comprehensive vol analysis: realized vol, IV-RV spreads, skew profiles, "
            "term structure, GEX by DTE, theta decay, put/call breakdown, liquidity."
        ),
        "path": "/v1/volatility/{symbol}",
        "path_params": ["symbol"],
        "query_params": [],
    },
    {
        "name": "get_dex",
        "description": "Delta exposure (DEX) by strike. Requires Basic plan+.",
        "path": "/v1/exposure/dex/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["expiration"],
    },
    {
        "name": "get_vex",
        "description": "Vanna exposure (VEX) by strike — delta sensitivity to IV changes. Requires Basic plan+.",
        "path": "/v1/exposure/vex/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["expiration"],
    },
    {
        "name": "get_chex",
        "description": "Charm exposure (CHEX) by strike — delta decay over time. Requires Basic plan+.",
        "path": "/v1/exposure/chex/{symbol}",
        "path_params": ["symbol"],
        "query_params": ["expiration"],
    },
    {
        "name": "get_active_symbols",
        "description": "List symbols currently cached with live data.",
        "path": "/v1/symbols",
        "path_params": [],
        "query_params": [],
    },
    {
        "name": "get_account_info",
        "description": "Get account info and API quota/rate limit status.",
        "path": "/v1/account",
        "path_params": [],
        "query_params": [],
    },
]


class FlashAlphaDeps(BaseModel):
    api_key: Optional[str] = None


class OrchestratorDeps(BaseModel):
    """Deps for the orchestrator agent — carries the FlashAlpha key for
    delegated specialist runs and the shared SSE event queue (set per-request)."""

    model_config = {"arbitrary_types_allowed": True}

    api_key: Optional[str] = None
    event_queue: Any = None  # asyncio.Queue, injected by stream_chat per request


_ORCHESTRATOR_PROMPT_TEMPLATE = (
    "You are the option GEX Quant Analyst Orchestrator (today: {today}), coordinating a team of "
    "domain-specialist agents over live FlashAlpha options data. "
    "You have NO direct data tools of your own — you can only delegate. Specialists:\n"
    "{roster}\n"
    "Rules: "
    "1. Read the user's question and identify which specialist domain(s) it touches. "
    "2. Delegate to the relevant specialist(s) by calling their delegation tool with a "
    "focused sub-question — call more than one in the same turn when the question spans "
    "domains (e.g. both exposure and volatility for a cross-domain ask). "
    "3. Wait for all delegated findings, then produce ONE synthesized, leveled answer in "
    "clean markdown — never invent data yourself, only restate and connect what the "
    "specialists reported. "
    "4. NEVER start your response with 'I', 'Let me', 'Me', or any first-person preamble "
    "— go straight to the synthesis. "
    "5. Use ## headers, **bold** key values, and tables when comparing across domains. "
    "6. If a specialist reports an error, acknowledge the gap honestly rather than "
    "inventing a substitute answer for that domain."
)

_SPECIALIST_PROMPT_TEMPLATE = (
    "You are the {label}, a specialist in {description} (today: {today}). "
    "Rules: "
    "1. Always call the relevant tool before answering any market question — never invent "
    "numbers. "
    "2. Be concise and data-driven: lead with the most actionable number or level, then "
    "context. "
    "3. Respond as plain, dense findings (no markdown headers, no greeting, no "
    "first-person preamble) — your output is consumed by another agent for synthesis, "
    "not shown directly to the end user."
)


def _specialist_system_prompt(spec: dict) -> str:
    return _SPECIALIST_PROMPT_TEMPLATE.format(
        label=spec["label"], description=spec["description"], today=date.today().isoformat()
    )


def _orchestrator_system_prompt() -> str:
    roster = "\n".join(
        f"- {spec['label']} (`delegate_to_{spec['name']}_agent`): {spec['description']}"
        for spec in SPECIALIST_REGISTRY
    )
    return _ORCHESTRATOR_PROMPT_TEMPLATE.format(today=date.today().isoformat(), roster=roster)


SPECIALIST_REGISTRY: list[dict] = [
    {
        "name": "exposure",
        "label": "Exposure Agent",
        "description": "gamma/delta/vanna/charm exposure, key options-derived levels, and dealer positioning",
        "tool_names": [
            "get_gex", "get_key_levels", "get_exposure_summary",
            "get_dex", "get_vex", "get_chex",
        ],
    },
    {
        "name": "volatility",
        "label": "Volatility Agent",
        "description": "implied/realized volatility, skew, term structure, options pricing greeks, and stock summaries",
        "tool_names": [
            "get_volatility_analysis", "get_bsm_greeks",
            "get_implied_vol", "get_stock_summary",
        ],
    },
    {
        "name": "market_structure",
        "label": "Market Structure Agent",
        "description": "live quotes, options-flow narrative, 0DTE dynamics, max pain, available symbols, and account status",
        "tool_names": [
            "get_stock_quote", "get_narrative", "get_zero_dte",
            "get_max_pain"
        ],
    },
]


def _build_input_model(spec: dict) -> type[BaseModel]:
    fields: dict = {}
    for param in spec["path_params"]:
        fields[param] = (str, Field(..., description=f"The {param} (e.g. 'SPY', 'AAPL')"))
    for param in spec["query_params"]:
        fields[param] = (str | None, Field(default=None, description=f"Optional: {param}"))

    return type(
        f"{spec['name']}_input",
        (BaseModel,),
        {
            "__annotations__": {k: v[0] for k, v in fields.items()},
            **{k: v[1] for k, v in fields.items()},
        },
    )


def _make_tool_fn(spec: dict, input_model: type[BaseModel]):
    async def tool_fn(ctx: RunContext[FlashAlphaDeps], params: input_model) -> dict[str, Any]:
        path = spec["path"]
        for p in spec["path_params"]:
            val = getattr(params, p, None)
            if val:
                path = path.replace(f"{{{p}}}", val.upper())

        query = {
            p: getattr(params, p)
            for p in spec["query_params"]
            if getattr(params, p, None) is not None
        }

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{FLASHALPHA_BASE}{path}",
                    params=query,
                    headers={"X-Api-Key": ctx.deps.api_key},
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
        except httpx.TimeoutException:
            return {"error": "Request timed out"}
        except Exception as e:
            logger.exception("Tool %s failed", spec["name"])
            return {"error": "Tool request failed"}

    tool_fn.__name__ = spec["name"]
    tool_fn.__doc__ = spec["description"]
    return tool_fn


def _build_agent(model_name: str) -> Agent:
    model = OpenAIChatModel(
        model_name,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    a = Agent(
        model,
        deps_type=FlashAlphaDeps,
        system_prompt=(
            f"You are GEX Analyst, a professional options market intelligence system (today: {date.today().isoformat()}). "
            "You have access to live FlashAlpha options data via tools. "
            "Rules: "
            "1. NEVER start a response with 'I', 'Let me', 'Me', or any first-person preamble — go straight to the data. "
            "2. Always call the relevant tool before answering any market question — never invent numbers. "
            "3. Format responses in clean markdown: use ## headers, **bold** key values, and tables for structured data. "
            "4. Be concise and data-driven. Lead with the most actionable number or level, then context. "
            "5. For key levels questions: always include gamma flip, call wall, put wall, and spot relative to those levels. "
            "6. For entry/exit suggestions: state the level, direction, and invalidation strike explicitly."
        ),
    )
    for spec in ENDPOINT_SPEC:
        input_model = _build_input_model(spec)
        a.tool(_make_tool_fn(spec, input_model))
    return a


# Module-level agent cache: key = model_name
_agents: dict[str, Agent] = {}


def _get_agent(model_name: str) -> Agent:
    if model_name not in _agents:
        _agents[model_name] = _build_agent(model_name)
    return _agents[model_name]


def _convert_history(messages: list[dict]) -> tuple[str, list]:
    """Convert [{role, content}] array to (user_prompt, message_history).

    Returns the last user message as user_prompt and all prior turns as
    typed Pydantic AI ModelMessage history.
    """
    history: list = []
    for msg in messages[:-1]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=content)]))
        elif role == "assistant":
            history.append(ModelResponse(parts=[TextPart(content=content)]))
        # system messages are handled via the system_prompt on the agent; skip here

    user_prompt = messages[-1].get("content", "") if messages else ""
    return user_prompt, history


async def stream_chat(
    messages: list[dict],
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream SSE-encoded events for a chat turn.

    Yields newline-delimited `data: <json>\\n\\n` strings of the form:
        {type: "text", delta: "..."}
        {type: "tool", name: "get_gex"}
        {type: "error", message: "..."}
        {type: "done"}
    """
    model_name = model or settings.openrouter_model
    deps = FlashAlphaDeps(api_key=settings.flash_alpha_api_key)
    user_prompt, history = _convert_history(messages)

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    try:
        agent = _get_agent(model_name)
    except Exception:
        logger.exception("Agent init failed for model %s", model_name)
        yield _sse({"type": "error", "message": "Agent initialization failed"})
        yield _sse({"type": "done"})
        return

    try:
        async with agent.iter(
            user_prompt,
            message_history=history or None,
            deps=deps,
            model_settings={"max_tokens": settings.chat_max_tokens},
        ) as agent_run:
            async for node in agent_run:
                if isinstance(node, End):
                    break

                if isinstance(node, ModelRequestNode):
                    # Stream text deltas from the model response
                    async with node.stream(agent_run.ctx) as agent_stream:
                        async for event in agent_stream:
                            if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                yield _sse({"type": "text", "delta": event.delta.content_delta})

                elif isinstance(node, CallToolsNode):
                    # Emit tool call names as they are invoked
                    async with node.stream(agent_run.ctx) as events:
                        async for event in events:
                            if isinstance(event, FunctionToolCallEvent):
                                yield _sse({"type": "tool", "name": event.part.tool_name})

    except Exception:
        logger.exception("Chat stream error")
        yield _sse({"type": "error", "message": "An error occurred while processing your request"})

    yield _sse({"type": "done"})
