"""
AI chat service: dynamic Pydantic AI agent over all FlashAlpha REST endpoints.
Ported from backend/flashalpha_agent.py with proper imports, streaming, and error handling.
"""

import asyncio
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
from backend.services import indicators

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
        "name": "get_stock_bars_with_indicators",
        "description": (
            "Fetch a 60-minute window of 1-minute OHLCV + flow bars and compute "
            "MACD, OBV, Cumulative Delta, and VWAP. Returns a compact pre-computed "
            "indicator summary for an intraday long/short technical read."
        ),
        "path": "/v1/flow/stocks/{symbol}/bars",
        "path_params": ["symbol"],
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
    base = _SPECIALIST_PROMPT_TEMPLATE.format(
        label=spec["label"], description=spec["description"], today=date.today().isoformat()
    )
    extra = spec.get("prompt_extra", "")
    return f"{base} {extra}".rstrip() if extra else base


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
    {
        "name": "technical_analyst",
        "label": "Technical Analyst Agent",
        "description": (
            "intraday momentum and order-flow technicals (MACD, OBV, Cumulative "
            "Delta, VWAP) over a 60-minute window to call long/short bias"
        ),
        "tool_names": ["get_stock_bars_with_indicators"],
        "prompt_extra": (
            "After calling the tool, weigh the four signals together and output a "
            "verdict: **LONG**, **SHORT**, or **NEUTRAL**, a confidence "
            "(low/medium/high), then one line of evidence citing the specific "
            "indicator values that drove it. MACD crossover = momentum direction; "
            "OBV trend = volume confirmation; Cumulative Delta = live buy/sell "
            "pressure; VWAP position = whether price is above/below the session's "
            "volume-weighted fair value (above confirms long bias, below confirms "
            "short). When the signals disagree, favor NEUTRAL and say why. If "
            "window_short is true or data is thin, temper confidence."
        ),
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


def _make_bars_indicator_tool_fn(spec: dict, input_model: type[BaseModel]):
    """Like _make_tool_fn but hardcodes resolution=1m&minutes=60 and post-processes
    the raw bars through indicators.build_indicator_summary instead of returning them."""

    async def tool_fn(ctx: RunContext[FlashAlphaDeps], params: input_model) -> dict[str, Any]:
        symbol = (getattr(params, "symbol", "") or "").upper()
        path = spec["path"].replace("{symbol}", symbol)
        query = {"resolution": "1m", "minutes": 60}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{FLASHALPHA_BASE}{path}",
                    params=query,
                    headers={"X-Api-Key": ctx.deps.api_key},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
        except httpx.TimeoutException:
            return {"error": "Request timed out"}
        except Exception:
            logger.exception("Tool %s failed", spec["name"])
            return {"error": "Tool request failed"}

        bars = data.get("bars", []) if isinstance(data, dict) else []
        return indicators.build_indicator_summary(symbol, bars)

    tool_fn.__name__ = spec["name"]
    tool_fn.__doc__ = spec["description"]
    return tool_fn


_ENDPOINT_BY_NAME: dict[str, dict] = {spec["name"]: spec for spec in ENDPOINT_SPEC}


def _build_specialist_agent(spec: dict, model_name: str) -> Agent:
    model = OpenAIChatModel(
        model_name,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    a = Agent(
        model,
        deps_type=FlashAlphaDeps,
        system_prompt=_specialist_system_prompt(spec),
    )
    for tool_name in spec["tool_names"]:
        endpoint = _ENDPOINT_BY_NAME[tool_name]
        input_model = _build_input_model(endpoint)
        if tool_name == "get_stock_bars_with_indicators":
            a.tool(_make_bars_indicator_tool_fn(endpoint, input_model))
        else:
            a.tool(_make_tool_fn(endpoint, input_model))
    return a


# Module-level specialist agent cache: key = (specialist_name, model_name)
_specialist_agents: dict[tuple[str, str], Agent] = {}


def _get_specialist_agent(name: str, model_name: str) -> Agent:
    key = (name, model_name)
    if key not in _specialist_agents:
        spec = next(s for s in SPECIALIST_REGISTRY if s["name"] == name)
        _specialist_agents[key] = _build_specialist_agent(spec, model_name)
    return _specialist_agents[key]


def _make_delegation_tool(spec: dict, model_name: str):
    """Build an orchestrator tool that runs the named specialist, forwarding its
    streamed events (tagged with the specialist's name) onto the shared queue in
    `ctx.deps.event_queue`, and returning its final text as the tool result."""

    async def delegate_fn(ctx: RunContext[OrchestratorDeps], query: str) -> str:
        queue = ctx.deps.event_queue
        agent = _get_specialist_agent(spec["name"], model_name)
        deps = FlashAlphaDeps(api_key=ctx.deps.api_key)
        tag = spec["name"]

        await queue.put({"type": "agent_event", "agent": tag, "kind": "start"})
        try:
            async with agent.iter(query, deps=deps) as run:
                async for node in run:
                    if isinstance(node, End):
                        break
                    if isinstance(node, ModelRequestNode):
                        async with node.stream(run.ctx) as agent_stream:
                            async for event in agent_stream:
                                if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                    await queue.put({
                                        "type": "agent_event", "agent": tag,
                                        "kind": "text", "delta": event.delta.content_delta,
                                    })
                    elif isinstance(node, CallToolsNode):
                        async with node.stream(run.ctx) as events:
                            async for event in events:
                                if isinstance(event, FunctionToolCallEvent):
                                    await queue.put({
                                        "type": "agent_event", "agent": tag,
                                        "kind": "tool", "name": event.part.tool_name,
                                    })
                output = run.result.output if run.result else ""
        except Exception:
            logger.exception("Specialist %s failed", tag)
            await queue.put({"type": "agent_event", "agent": tag, "kind": "done", "summary": "Failed to complete"})
            return json.dumps({"error": f"{spec['label']} failed to complete its analysis"})

        summary = (output or "").strip().replace("\n", " ")[:200]
        await queue.put({"type": "agent_event", "agent": tag, "kind": "done", "summary": summary})
        return output

    delegate_fn.__name__ = f"delegate_to_{spec['name']}_agent"
    delegate_fn.__doc__ = (
        f"Delegate to the {spec['label']}, a specialist in {spec['description']}. "
        "Pass a focused sub-question covering only what this specialist should answer."
    )
    return delegate_fn


def _build_orchestrator_agent(model_name: str) -> Agent:
    model = OpenAIChatModel(
        model_name,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    a = Agent(
        model,
        deps_type=OrchestratorDeps,
        system_prompt=_orchestrator_system_prompt(),
    )
    for spec in SPECIALIST_REGISTRY:
        a.tool(_make_delegation_tool(spec, model_name))
    return a


# Module-level orchestrator agent cache: key = model_name
_orchestrators: dict[str, Agent] = {}


def _get_orchestrator(model_name: str) -> Agent:
    if model_name not in _orchestrators:
        _orchestrators[model_name] = _build_orchestrator_agent(model_name)
    return _orchestrators[model_name]


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

    The orchestrator's run is driven as a background task that pushes its own
    events (and each delegated specialist pushes its own, tagged) onto one
    shared queue; this generator simply drains that queue in order.

    Yields newline-delimited `data: <json>\\n\\n` strings of the form:
        {type: "text", delta: "..."}                                   — orchestrator text
        {type: "tool", name: "delegate_to_exposure_agent"}             — orchestrator delegation call
        {type: "agent_event", agent: "exposure", kind: "start"}        — specialist lifecycle
        {type: "agent_event", agent: "exposure", kind: "tool", name}
        {type: "agent_event", agent: "exposure", kind: "text", delta}
        {type: "agent_event", agent: "exposure", kind: "done", summary}
        {type: "error", message: "..."}
        {type: "done"}
    """
    model_name = model or settings.openrouter_model
    user_prompt, history = _convert_history(messages)

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    try:
        orchestrator = _get_orchestrator(model_name)
    except Exception:
        logger.exception("Agent init failed for model %s", model_name)
        yield _sse({"type": "error", "message": "Agent initialization failed"})
        yield _sse({"type": "done"})
        return

    queue: asyncio.Queue = asyncio.Queue()
    deps = OrchestratorDeps(api_key=settings.flash_alpha_api_key, event_queue=queue)
    _SENTINEL = object()

    async def _run_orchestrator() -> None:
        try:
            async with orchestrator.iter(
                user_prompt,
                message_history=history or None,
                deps=deps,
                model_settings={"max_tokens": settings.chat_max_tokens},
            ) as agent_run:
                async for node in agent_run:
                    if isinstance(node, End):
                        break

                    if isinstance(node, ModelRequestNode):
                        async with node.stream(agent_run.ctx) as agent_stream:
                            async for event in agent_stream:
                                if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                    await queue.put({"type": "text", "delta": event.delta.content_delta})

                    elif isinstance(node, CallToolsNode):
                        async with node.stream(agent_run.ctx) as events:
                            async for event in events:
                                if isinstance(event, FunctionToolCallEvent):
                                    await queue.put({"type": "tool", "name": event.part.tool_name})
        except Exception:
            logger.exception("Chat stream error")
            await queue.put({"type": "error", "message": "An error occurred while processing your request"})
        finally:
            await queue.put(_SENTINEL)

    task = asyncio.create_task(_run_orchestrator())
    try:
        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield _sse(item)
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    yield _sse({"type": "done"})
