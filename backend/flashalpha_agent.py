"""
FlashAlpha dynamic tool generation with PydanticAI + OpenRouter.

Install:
    pip install pydantic-ai httpx
"""

import httpx
import asyncio
from typing import Any, Optional
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from config import settings

# ─────────────────────────────────────────────
# OpenRouter config
# ─────────────────────────────────────────────

OPENROUTER_API_KEY = settings.openrouter_api_key   # <-- your OpenRouter key

# Pick any model from openrouter.ai/models
# Good tool-calling options: check from openrouter and choose cheaper one.
#   "anthropic/claude-sonnet-4-5"
#   "openai/gpt-4o"
#   "google/gemini-2.5-pro"
#   "mistralai/mistral-large"
#.  "deepseek/deepseek-v4-flash"
OPENROUTER_MODEL = "deepseek/deepseek-v4-flash"

model = OpenAIChatModel(
    OPENROUTER_MODEL,
    provider=OpenAIProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    ),
)


# ─────────────────────────────────────────────
# FlashAlpha API spec
# ─────────────────────────────────────────────

FLASHALPHA_BASE = "https://lab.flashalpha.com"

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
    }
]


# ─────────────────────────────────────────────
# Agent dependencies
# ─────────────────────────────────────────────

class FlashAlphaDeps(BaseModel):
    api_key: Optional[str] = None


# ─────────────────────────────────────────────
# Dynamic tool builder
# ─────────────────────────────────────────────

def build_input_model(spec: dict) -> type[BaseModel]:
    fields = {}
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


def make_tool_fn(spec: dict, input_model: type[BaseModel]):
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

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{FLASHALPHA_BASE}{path}",
                params=query,
                headers={"X-Api-Key": ctx.deps.api_key},
            )
            resp.raise_for_status()
            return resp.json()

    tool_fn.__name__ = spec["name"]
    tool_fn.__doc__ = spec["description"]
    return tool_fn


# ─────────────────────────────────────────────
# Build agent + register all tools
# ─────────────────────────────────────────────

agent = Agent(
    model,
    deps_type=FlashAlphaDeps,
    system_prompt=(
        "You are a professional options market analyst with access to live FlashAlpha "
        "options data. Use the available tools to fetch real-time gamma exposure, "
        "key levels, greeks, and volatility data. Be concise and data-driven."
    ),
)

for spec in ENDPOINT_SPEC:
    input_model = build_input_model(spec)
    agent.tool(make_tool_fn(spec, input_model))


# ─────────────────────────────────────────────
# Test
# ─────────────────────────────────────────────

async def main():
    FLASHALPHA_KEY = settings.flash_alpha_api_key   # <-- replace

    deps = FlashAlphaDeps(api_key=FLASHALPHA_KEY)

    print(f"Model  : {OPENROUTER_MODEL}")
    print(f"Tools  : {len(ENDPOINT_SPEC)} endpoints registered")
    print("-" * 50)

    # result = await agent.run(
    #     "What are the key GEX levels for SPY right now? "
    #     "Tell me the gamma flip, call wall, and put wall.",
    #     deps=deps,
    # )

    result = await agent.run(
        "What is the expected closing price of SPY by end of this week according to the weekly expiry GEX call wall and put wall and price action?",
        deps=deps,
    )
    print(result.output)


if __name__ == "__main__":
    asyncio.run(main())