# Technical Analyst Agent — Design Spec

**Date:** 2026-06-08
**Status:** Approved, ready for implementation plan
**Branch:** feature/multi-agent

## Summary

Add a new **Technical Analyst** specialist agent to the existing multi-agent
chat orchestration. It fetches a 60-minute window of 1-minute OHLCV + flow bars
from FlashAlpha, computes three momentum/order-flow indicators in **Python**
(MACD, OBV, Cumulative Delta), and produces an intraday **LONG / SHORT /
NEUTRAL** verdict with confidence and evidence. The orchestrator routes
technical-read questions to it automatically.

## Goals

- Give the agent team an intraday technicals capability driven by the live trade
  tape, not just options-exposure data.
- Compute indicators deterministically in Python — the LLM interprets, it does
  not do the arithmetic.
- Output a fast, actionable verdict (verdict + confidence + one line of evidence),
  not a wall of numbers.

## Non-Goals

- No scheduling / background auto-signals. On-demand delegation only.
- No new frontend components. The agent trace renders dynamically from the SSE
  stream.
- No configurable window. The lookback is fixed at 60 one-minute bars.

## Key Decisions

- **Indicators computed in Python (Option A), not by the LLM.** MACD requires
  exact EMA recursion; OBV requires a running accumulator; Cumulative Delta is a
  running sum. These are deterministic — LLM arithmetic errors would silently
  produce wrong signals.
- **One combined tool, not fetch + compute split.** The single tool fetches and
  computes atomically so the agent can't skip the compute step or mis-sequence
  calls.
- **New specialist (4th in registry), not bolted onto Market Structure.** Keeps
  domains clean and reuses the existing delegation-generation loop verbatim.
- **Fixed window: `resolution=1m&minutes=60`.** 60 bars gives MACD a real
  EMA(26) + EMA(9) signal runway and stabilizes OBV / Cumulative Delta trend
  reads. Not agent-overridable, so indicators are consistent run-to-run.

## Data Layer

### New endpoint in `ENDPOINT_SPEC` (`backend/services/chat.py`)

```python
{
    "name": "get_stock_bars_with_indicators",
    "description": (
        "Fetch a 60-minute window of 1-minute OHLCV + flow bars and compute "
        "MACD, OBV, and Cumulative Delta. Returns a compact pre-computed "
        "indicator summary for an intraday long/short technical read."
    ),
    "path": "/v1/flow/stocks/{symbol}/bars",
    "path_params": ["symbol"],
    "query_params": [],
}
```

`query_params` is intentionally empty so the agent supplies **only `symbol`** —
`resolution=1m` and `minutes=60` are not agent-controllable.

Because this tool both hardcodes those query params **and** post-processes the
response through indicator math, it does **not** use the generic `_make_tool_fn`.
A dedicated tool function (`_make_bars_indicator_tool_fn`) handles it: it injects
`resolution=1m&minutes=60`, fetches via the same `httpx` + `X-Api-Key` pattern,
then returns the enriched dict below instead of the raw bars. The specialist's
build step routes this one endpoint to the dedicated function and all others to
`_make_tool_fn`.

### FlashAlpha bars response (input)

`GET https://lab.flashalpha.com/v1/flow/stocks/{symbol}/bars?resolution=1m&minutes=60`

Returns `{symbol, resolution, minutes, count, dataStartUtc, bars: [...]}`,
oldest-first. Each bar:

```
ts, closed, open, high, low, close, vwap,
buyVolume, sellVolume, midVolume, netVolume, tradeCount, biggestTrade
```

### Tool output (enriched summary)

```json
{
  "symbol": "SPY",
  "bars_count": 60,
  "latest_close": 738.745,
  "window_short": false,
  "macd": { "macd_line": 0.12, "signal_line": 0.08, "histogram": 0.04, "crossover": "bullish" },
  "obv": { "current": 12450, "trend": "rising", "bars_rising": 34, "bars_falling": 21 },
  "cumulative_delta": { "total": -340, "latest_bar_delta": -1, "bias": "bearish" }
}
```

## Indicator Definitions (`backend/services/indicators.py`)

New module of **pure functions, no I/O** — easy to unit-test in isolation from
HTTP/agent wiring. Input: the `bars` list (oldest-first). Output: the indicator
sub-dicts above.

- **MACD**: `EMA(12) − EMA(26)` over `close`; Signal = `EMA(9)` of the MACD line;
  Histogram = MACD line − Signal. `crossover` = `"bullish"` when MACD line is
  above signal (histogram > 0), `"bearish"` when below, `"flat"` when ~0.
  Standard EMA recursion seeded by SMA of the first `period` closes.
- **OBV (On-Balance Volume)**: running accumulator. Per bar, `volume =
  buyVolume + sellVolume + midVolume`. If `close > prev_close` add volume; if
  `close < prev_close` subtract; if equal, unchanged. `trend` derived from the
  sign of OBV's recent slope (e.g. last value vs. window start); `bars_rising` /
  `bars_falling` count close-to-close up/down bars.
- **Cumulative Delta**: running sum of `netVolume` (`buyVolume − sellVolume`)
  across all bars. `latest_bar_delta` = last bar's `netVolume`. `bias` =
  `"bullish"` if total > 0, `"bearish"` if < 0, `"neutral"` if ~0.

### Edge cases

- **Empty `bars`** → return a summary with `bars_count: 0` and null/`"n/a"`
  indicator fields; the agent reports it can't read with no data.
- **Single bar** → OBV = 0 (no prior close), Cumulative Delta = that bar's
  netVolume, MACD `window_short: true`.
- **All-flat closes** → OBV stays 0, MACD histogram ~0 → `crossover: "flat"`.
- **Fewer than 26 bars** → set `window_short: true`; still compute with available
  data; agent tempers confidence.

## Specialist Registration

Append a 4th entry to `SPECIALIST_REGISTRY` (`backend/services/chat.py`):

```python
{
    "name": "technical_analyst",
    "label": "Technical Analyst Agent",
    "description": (
        "intraday momentum and order-flow technicals (MACD, OBV, Cumulative "
        "Delta) over a 60-minute window to call long/short bias"
    ),
    "tool_names": ["get_stock_bars_with_indicators"],
    "prompt_extra": (
        "After calling the tool, weigh the three signals together and output a "
        "verdict: **LONG**, **SHORT**, or **NEUTRAL**, a confidence "
        "(low/medium/high), then one line of evidence citing the specific "
        "indicator values that drove it. MACD crossover = momentum direction; "
        "OBV trend = volume confirmation; Cumulative Delta = live buy/sell "
        "pressure. When the three disagree, favor NEUTRAL and say why. If "
        "window_short is true or data is thin, temper confidence."
    ),
}
```

`_specialist_system_prompt` is extended to append `spec.get("prompt_extra", "")`
to the base template. The other three specialists have no `prompt_extra`, so
their prompts are unchanged.

The orchestrator picks this up with **no new orchestration code**:
`_build_orchestrator_agent` already loops `SPECIALIST_REGISTRY` to generate
`delegate_to_technical_analyst_agent`, and `_orchestrator_system_prompt`
regenerates the roster from the registry.

## End-to-End Flow

```
User: "Is SPY a long or short right now?"
  → orchestrator delegates → delegate_to_technical_analyst_agent("SPY long/short technical read")
    → Technical Analyst calls get_stock_bars_with_indicators(symbol="SPY")
      → Python: GET /v1/flow/stocks/SPY/bars?resolution=1m&minutes=60
      → Python: compute MACD / OBV / Cumulative Delta over ~60 bars (indicators.py)
      → returns compact indicator dict
    → Technical Analyst interprets → "LONG, medium confidence — MACD bullish
      crossover (hist +0.04), OBV rising, CumΔ -340 (mild sell pressure but
      momentum + volume lead)."
  → orchestrator synthesizes final answer to user
```

The specialist's tool call and done-summary stream as tagged `agent_event`
frames; the frontend trace shows a new `technical_analyst` row automatically.

## Frontend

**No changes required.** `ChatMessage.jsx`'s `AgentTrace` and
`useAISessions.js` render any `event.agent` seen in the stream dynamically
(`label || name`). The new specialist shows as `technical_analyst`, consistent
with how `exposure` / `volatility` / `market_structure` already display raw
names.

*(Optional future polish, out of scope: have the backend emit each specialist's
human `label` in `agent_event` frames so the trace shows "Technical Analyst
Agent" for all four.)*

## Testing

Extend `backend/tests/test_chat_specialists.py` and add indicator unit tests.

1. **Indicator unit tests** (highest value — deterministic):
   - MACD over a known close series → exact macd_line / signal_line / histogram /
     crossover.
   - OBV over a known close+volume series → exact accumulator value and trend.
   - Cumulative Delta over known netVolumes → exact total, latest_bar_delta, bias.
2. **Edge cases**: empty bars; single bar; all-flat closes (OBV 0,
   crossover flat); < 26 bars sets `window_short: true`.
3. **Registry wiring**: `technical_analyst` resolves; `_build_specialist_agent`
   exposes exactly `{get_stock_bars_with_indicators}`; orchestrator generates
   `delegate_to_technical_analyst_agent` (covered by existing
   `test_orchestrator_has_one_delegation_tool_per_specialist` once the registry
   entry is added).

## Files Touched

- `backend/services/indicators.py` — **new**: pure indicator functions.
- `backend/services/chat.py` — add endpoint spec, registry entry, `prompt_extra`
  support in `_specialist_system_prompt`, and a dedicated
  `_make_bars_indicator_tool_fn` (hardcodes `resolution=1m&minutes=60`,
  post-processes via `indicators.py`); `_build_specialist_agent` routes the
  `get_stock_bars_with_indicators` endpoint to that function, all others to
  `_make_tool_fn`.
- `backend/tests/test_chat_specialists.py` (or new `test_indicators.py`) — tests
  above.
- No frontend files.
