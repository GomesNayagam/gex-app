# Technical Analyst Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th specialist — the Technical Analyst Agent — that fetches a fixed 60-minute window of 1-minute OHLCV+flow bars from FlashAlpha and returns a pre-computed MACD / OBV / Cumulative Delta / VWAP summary for an intraday long/short read.

**Architecture:** Indicator math lives in a new pure-function module (`backend/services/indicators.py`, no I/O). A dedicated tool function in `chat.py` hardcodes `resolution=1m&minutes=60`, fetches via the existing `httpx` + `X-Api-Key` pattern, then post-processes the raw bars through `indicators.py` into a compact enriched dict. The specialist is registered as a 4th `SPECIALIST_REGISTRY` entry with a `prompt_extra`; the orchestrator picks it up with no new orchestration code (it already loops the registry to generate `delegate_to_*` tools and the roster).

**Tech Stack:** Python 3.11+, FastAPI, pydantic-ai 1.104, httpx, pytest (asyncio auto-mode). Run tests with `uv run pytest`.

**Spec:** `docs/superpowers/specs/2026-06-08-technical-analyst-agent-design.md`

---

## File Structure

- **Create** `backend/services/indicators.py` — pure indicator functions (no I/O): `compute_macd`, `compute_obv`, `compute_cumulative_delta`, `compute_vwap`, and an orchestrating `build_indicator_summary`. Sole responsibility: turn a `bars` list into the enriched summary dict.
- **Create** `backend/tests/test_indicators.py` — unit tests for the pure functions and edge cases.
- **Modify** `backend/services/chat.py` — add the endpoint to `ENDPOINT_SPEC`, add `prompt_extra` support to `_specialist_system_prompt`, add `_make_bars_indicator_tool_fn`, route that one endpoint to it inside `_build_specialist_agent`, and append the `technical_analyst` registry entry.
- **Modify** `backend/tests/test_chat_specialists.py` — assert the new specialist wires up with exactly its one tool (the existing parametrized tests already cover registry resolution and per-specialist delegation once the entry exists).

---

## Task 0: Bank a green baseline

**Files:** none (verification only)

- [ ] **Step 1: Confirm the suite is green before any change**

Run: `uv run pytest -q`
Expected: PASS. This is cheap insurance — any red during execution is then provably yours, not pre-existing.

---

## Task 1: Indicator module — VWAP and Cumulative Delta (simplest, no recursion)

**Files:**
- Create: `backend/services/indicators.py`
- Test: `backend/tests/test_indicators.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_indicators.py
"""Unit tests for backend/services/indicators.py — pure indicator math, no I/O."""

from backend.services import indicators


def _bar(close, buy=0, sell=0, mid=0, net=None, vwap=0.0):
    """Minimal bar matching the FlashAlpha /bars shape (fields the indicators read)."""
    return {
        "close": close,
        "buyVolume": buy,
        "sellVolume": sell,
        "midVolume": mid,
        "netVolume": (buy - sell) if net is None else net,
        "vwap": vwap,
    }


def test_cumulative_delta_known_series():
    bars = [
        _bar(100, net=-100),
        _bar(101, net=50),
        _bar(100, net=-300),
        _bar(101, net=10),
    ]
    result = indicators.compute_cumulative_delta(bars)
    assert result["total"] == -340
    assert result["latest_bar_delta"] == 10
    assert result["bias"] == "bearish"


def test_cumulative_delta_positive_total_is_bullish():
    bars = [_bar(100, net=200), _bar(101, net=50)]
    result = indicators.compute_cumulative_delta(bars)
    assert result["total"] == 250
    assert result["bias"] == "bullish"


def test_cumulative_delta_zero_total_is_neutral():
    bars = [_bar(100, net=100), _bar(100, net=-100)]
    result = indicators.compute_cumulative_delta(bars)
    assert result["total"] == 0
    assert result["bias"] == "neutral"


def test_vwap_close_above_is_above():
    bars = [_bar(100, vwap=99.0), _bar(101, vwap=100.0)]
    result = indicators.compute_vwap(bars, latest_close=101.0)
    assert result["latest"] == 100.0
    assert result["close_vs_vwap"] == 1.0
    assert result["position"] == "above"


def test_vwap_close_below_is_below():
    bars = [_bar(100, vwap=102.0)]
    result = indicators.compute_vwap(bars, latest_close=100.0)
    assert result["position"] == "below"


def test_vwap_close_equal_is_at():
    bars = [_bar(100, vwap=100.0)]
    result = indicators.compute_vwap(bars, latest_close=100.0)
    assert result["position"] == "at"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest backend/tests/test_indicators.py -v`
Expected: FAIL with `ModuleNotFoundError` / `AttributeError: module 'backend.services.indicators' has no attribute 'compute_cumulative_delta'`.

- [ ] **Step 3: Create the module with VWAP and Cumulative Delta**

```python
# backend/services/indicators.py
"""Pure intraday indicator functions — no I/O, no HTTP, no agent wiring.

Input is the FlashAlpha `bars` list (oldest-first). Each bar is a dict with at
least: close, buyVolume, sellVolume, midVolume, netVolume, vwap.
Output sub-dicts match the enriched tool summary in the design spec.
"""

from typing import Any

# Threshold below which a float total/line is treated as zero ("flat"/"neutral").
_EPS = 1e-9


def compute_cumulative_delta(bars: list[dict]) -> dict[str, Any]:
    """Running sum of per-bar netVolume (buyVolume − sellVolume)."""
    total = sum(b.get("netVolume", 0) for b in bars)
    latest = bars[-1].get("netVolume", 0) if bars else 0
    if total > _EPS:
        bias = "bullish"
    elif total < -_EPS:
        bias = "bearish"
    else:
        bias = "neutral"
    return {"total": total, "latest_bar_delta": latest, "bias": bias}


def compute_vwap(bars: list[dict], latest_close: float) -> dict[str, Any]:
    """Pass-through of the last bar's session-anchored VWAP vs. the latest close."""
    latest = bars[-1].get("vwap", 0.0) if bars else 0.0
    diff = latest_close - latest
    if diff > _EPS:
        position = "above"
    elif diff < -_EPS:
        position = "below"
    else:
        position = "at"
    return {"latest": latest, "close_vs_vwap": diff, "position": position}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest backend/tests/test_indicators.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/indicators.py backend/tests/test_indicators.py
git commit -m "feat: add VWAP and Cumulative Delta indicators"
```

---

## Task 2: Indicator module — OBV (running accumulator)

**Files:**
- Modify: `backend/services/indicators.py`
- Test: `backend/tests/test_indicators.py`

- [ ] **Step 1: Write the failing tests**

```python
# Append to backend/tests/test_indicators.py

def test_obv_known_series():
    # volume per bar = buy + sell + mid
    bars = [
        _bar(100, buy=5, sell=5),    # vol 10, no prior close -> OBV 0
        _bar(101, buy=12, sell=8),   # vol 20, up   -> +20
        _bar(100, buy=10, sell=20),  # vol 30, down -> -30 -> -10
        _bar(100, buy=20, sell=20),  # vol 40, flat -> unchanged -> -10
    ]
    result = indicators.compute_obv(bars)
    assert result["current"] == -10
    assert result["bars_rising"] == 1
    assert result["bars_falling"] == 1


def test_obv_rising_series_trend_rising():
    bars = [_bar(100, buy=5, sell=5), _bar(101, buy=10, sell=0), _bar(102, buy=10, sell=0)]
    result = indicators.compute_obv(bars)
    assert result["current"] == 20
    assert result["trend"] == "rising"
    assert result["bars_rising"] == 2
    assert result["bars_falling"] == 0


def test_obv_falling_series_trend_falling():
    bars = [_bar(102, buy=5, sell=5), _bar(101, buy=0, sell=10), _bar(100, buy=0, sell=10)]
    result = indicators.compute_obv(bars)
    assert result["current"] == -20
    assert result["trend"] == "falling"


def test_obv_single_bar_is_zero():
    result = indicators.compute_obv([_bar(100, buy=5, sell=5)])
    assert result["current"] == 0
    assert result["trend"] == "flat"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest backend/tests/test_indicators.py -k obv -v`
Expected: FAIL with `AttributeError: module ... has no attribute 'compute_obv'`.

- [ ] **Step 3: Add `compute_obv`**

```python
# Add to backend/services/indicators.py

def compute_obv(bars: list[dict]) -> dict[str, Any]:
    """On-Balance Volume running accumulator.

    Per bar volume = buyVolume + sellVolume + midVolume. Add it when close rises
    vs. the prior close, subtract when it falls, leave unchanged when equal.
    `trend` is the sign of OBV's net change from start to end of the window.
    """
    obv = 0
    bars_rising = 0
    bars_falling = 0
    prev_close = None
    for b in bars:
        volume = b.get("buyVolume", 0) + b.get("sellVolume", 0) + b.get("midVolume", 0)
        close = b.get("close", 0)
        if prev_close is not None:
            if close > prev_close:
                obv += volume
                bars_rising += 1
            elif close < prev_close:
                obv -= volume
                bars_falling += 1
        prev_close = close

    if obv > _EPS:
        trend = "rising"
    elif obv < -_EPS:
        trend = "falling"
    else:
        trend = "flat"
    return {
        "current": obv,
        "trend": trend,
        "bars_rising": bars_rising,
        "bars_falling": bars_falling,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest backend/tests/test_indicators.py -k obv -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/indicators.py backend/tests/test_indicators.py
git commit -m "feat: add OBV indicator"
```

---

## Task 3: Indicator module — MACD (EMA recursion)

**Files:**
- Modify: `backend/services/indicators.py`
- Test: `backend/tests/test_indicators.py`

- [ ] **Step 1: Write the failing tests**

A flat (constant) close series gives exact zeros — clean deterministic assertions. Monotonic series assert sign + crossover direction.

```python
# Append to backend/tests/test_indicators.py

def test_macd_flat_series_is_flat():
    closes = [100.0] * 40
    result = indicators.compute_macd(closes)
    assert result["macd_line"] == 0.0
    assert result["signal_line"] == 0.0
    assert result["histogram"] == 0.0
    assert result["crossover"] == "flat"
    assert result["window_short"] is False


def test_macd_rising_series_is_bullish():
    closes = [100.0 + i for i in range(40)]  # strictly increasing
    result = indicators.compute_macd(closes)
    assert result["macd_line"] > 0
    assert result["histogram"] > 0
    assert result["crossover"] == "bullish"


def test_macd_falling_series_is_bearish():
    closes = [200.0 - i for i in range(40)]  # strictly decreasing
    result = indicators.compute_macd(closes)
    assert result["macd_line"] < 0
    assert result["crossover"] == "bearish"


def test_macd_short_window_sets_flag():
    closes = [100.0 + i for i in range(10)]  # fewer than 26
    result = indicators.compute_macd(closes)
    assert result["window_short"] is True


def test_macd_empty_series():
    result = indicators.compute_macd([])
    assert result["macd_line"] == 0.0
    assert result["crossover"] == "flat"
    assert result["window_short"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest backend/tests/test_indicators.py -k macd -v`
Expected: FAIL with `AttributeError: module ... has no attribute 'compute_macd'`.

- [ ] **Step 3: Add EMA helper and `compute_macd`**

```python
# Add to backend/services/indicators.py

def _ema_series(values: list[float], period: int) -> list[float]:
    """EMA aligned to `values` (same length). Seeded with the SMA of the first
    min(period, len) values, then standard recursion: ema += (v - ema) * k,
    k = 2/(period+1). Robust to series shorter than `period` (seed shrinks)."""
    if not values:
        return []
    seed_n = min(period, len(values))
    ema = sum(values[:seed_n]) / seed_n
    k = 2 / (period + 1)
    out = [ema]
    for v in values[1:]:
        ema = (v - ema) * k + ema
        out.append(ema)
    return out


def compute_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> dict[str, Any]:
    """MACD line = EMA(fast) − EMA(slow); Signal = EMA(signal) of the MACD line;
    Histogram = MACD − Signal. crossover: bullish when histogram > 0, bearish
    when < 0, flat when ~0. window_short flags fewer than `slow` closes."""
    window_short = len(closes) < slow
    if not closes:
        return {
            "macd_line": 0.0, "signal_line": 0.0, "histogram": 0.0,
            "crossover": "flat", "window_short": True,
        }

    ema_fast = _ema_series(closes, fast)
    ema_slow = _ema_series(closes, slow)
    macd_line_series = [f - s for f, s in zip(ema_fast, ema_slow)]
    signal_series = _ema_series(macd_line_series, signal)

    macd_line = macd_line_series[-1]
    signal_line = signal_series[-1]
    histogram = macd_line - signal_line

    if histogram > _EPS:
        crossover = "bullish"
    elif histogram < -_EPS:
        crossover = "bearish"
    else:
        crossover = "flat"

    return {
        "macd_line": round(macd_line, 6),
        "signal_line": round(signal_line, 6),
        "histogram": round(histogram, 6),
        "crossover": crossover,
        "window_short": window_short,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run pytest backend/tests/test_indicators.py -k macd -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/indicators.py backend/tests/test_indicators.py
git commit -m "feat: add MACD indicator"
```

---

## Task 4: Indicator module — `build_indicator_summary` orchestrator + edge cases

**Files:**
- Modify: `backend/services/indicators.py`
- Test: `backend/tests/test_indicators.py`

- [ ] **Step 1: Write the failing tests**

```python
# Append to backend/tests/test_indicators.py

def test_build_summary_full_shape():
    bars = [
        _bar(100.0, buy=10, sell=5, net=5, vwap=99.5),
        _bar(101.0, buy=20, sell=5, net=15, vwap=100.0),
        _bar(100.5, buy=8, sell=12, net=-4, vwap=100.2),
    ]
    summary = indicators.build_indicator_summary("SPY", bars)
    assert summary["symbol"] == "SPY"
    assert summary["bars_count"] == 3
    assert summary["latest_close"] == 100.5
    # all four indicator blocks present
    assert set(summary["macd"]) >= {"macd_line", "signal_line", "histogram", "crossover"}
    assert set(summary["obv"]) >= {"current", "trend", "bars_rising", "bars_falling"}
    assert set(summary["cumulative_delta"]) >= {"total", "latest_bar_delta", "bias"}
    assert set(summary["vwap"]) >= {"latest", "close_vs_vwap", "position"}
    assert summary["window_short"] is True  # 3 < 26


def test_build_summary_empty_bars():
    summary = indicators.build_indicator_summary("SPY", [])
    assert summary["bars_count"] == 0
    assert summary["latest_close"] is None
    assert summary["macd"]["crossover"] == "flat"
    assert summary["obv"]["current"] == 0
    assert summary["cumulative_delta"]["total"] == 0
    assert summary["vwap"]["latest"] is None


def test_build_summary_single_bar():
    summary = indicators.build_indicator_summary("SPY", [_bar(100.0, net=7, vwap=99.0)])
    assert summary["bars_count"] == 1
    assert summary["obv"]["current"] == 0          # no prior close
    assert summary["cumulative_delta"]["total"] == 7
    assert summary["window_short"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest backend/tests/test_indicators.py -k build_summary -v`
Expected: FAIL with `AttributeError: module ... has no attribute 'build_indicator_summary'`.

- [ ] **Step 3: Add `build_indicator_summary`**

```python
# Add to backend/services/indicators.py

def build_indicator_summary(symbol: str, bars: list[dict]) -> dict[str, Any]:
    """Compose the compact enriched summary the tool returns. Handles empty
    bars by emitting zeroed/null indicator blocks (the agent reports it cannot
    read with no data)."""
    if not bars:
        return {
            "symbol": symbol,
            "bars_count": 0,
            "latest_close": None,
            "window_short": True,
            "macd": {"macd_line": 0.0, "signal_line": 0.0, "histogram": 0.0,
                     "crossover": "flat", "window_short": True},
            "obv": {"current": 0, "trend": "flat", "bars_rising": 0, "bars_falling": 0},
            "cumulative_delta": {"total": 0, "latest_bar_delta": 0, "bias": "neutral"},
            "vwap": {"latest": None, "close_vs_vwap": None, "position": "n/a"},
        }

    closes = [b.get("close", 0.0) for b in bars]
    latest_close = closes[-1]
    macd = compute_macd(closes)
    return {
        "symbol": symbol,
        "bars_count": len(bars),
        "latest_close": latest_close,
        "window_short": macd["window_short"],
        "macd": macd,
        "obv": compute_obv(bars),
        "cumulative_delta": compute_cumulative_delta(bars),
        "vwap": compute_vwap(bars, latest_close),
    }
```

- [ ] **Step 4: Run all indicator tests**

Run: `uv run pytest backend/tests/test_indicators.py -v`
Expected: PASS (all tests from Tasks 1–4).

- [ ] **Step 5: Commit**

```bash
git add backend/services/indicators.py backend/tests/test_indicators.py
git commit -m "feat: add build_indicator_summary orchestrator with edge-case handling"
```

---

## Task 5: Wire the tool into chat.py — endpoint spec + dedicated tool function

**Files:**
- Modify: `backend/services/chat.py` (add import; add `ENDPOINT_SPEC` entry; add `_make_bars_indicator_tool_fn`; route it in `_build_specialist_agent`)
- Test: `backend/tests/test_chat_specialists.py`

- [ ] **Step 1: Write the failing test**

```python
# Append to backend/tests/test_chat_specialists.py

import pytest
import httpx
from backend.services import chat


@pytest.mark.asyncio
async def test_bars_indicator_tool_hardcodes_window_and_enriches(monkeypatch):
    """The dedicated bars tool must inject resolution=1m&minutes=60 and return
    the enriched indicator summary, not the raw bars."""
    captured = {}

    class _FakeResp:
        def raise_for_status(self): pass
        def json(self):
            return {
                "symbol": "SPY", "resolution": "1m", "minutes": 60, "count": 2,
                "bars": [
                    {"close": 100.0, "buyVolume": 10, "sellVolume": 5, "midVolume": 0,
                     "netVolume": 5, "vwap": 99.5},
                    {"close": 101.0, "buyVolume": 20, "sellVolume": 5, "midVolume": 0,
                     "netVolume": 15, "vwap": 100.0},
                ],
            }

    class _FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None, headers=None):
            captured["url"] = url
            captured["params"] = params
            return _FakeResp()

    monkeypatch.setattr(httpx, "AsyncClient", _FakeClient)

    endpoint = chat._ENDPOINT_BY_NAME["get_stock_bars_with_indicators"]
    input_model = chat._build_input_model(endpoint)
    tool_fn = chat._make_bars_indicator_tool_fn(endpoint, input_model)

    ctx = type("Ctx", (), {"deps": chat.FlashAlphaDeps(api_key="k")})()
    result = await tool_fn(ctx, input_model(symbol="spy"))

    # window hardcoded, symbol upper-cased into the path
    assert captured["params"] == {"resolution": "1m", "minutes": 60}
    assert captured["url"].endswith("/v1/flow/stocks/SPY/bars")
    # enriched, not raw
    assert result["bars_count"] == 2
    assert "macd" in result and "vwap" in result
    assert "bars" not in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/tests/test_chat_specialists.py -k bars_indicator -v`
Expected: FAIL — `KeyError: 'get_stock_bars_with_indicators'` (endpoint not yet in `_ENDPOINT_BY_NAME`) / `AttributeError` for `_make_bars_indicator_tool_fn`.

- [ ] **Step 3a: Add the indicators import** near the other imports in `chat.py` (after `from backend.config import settings`, line 24):

```python
from backend.services import indicators
```

- [ ] **Step 3b: Append the endpoint to `ENDPOINT_SPEC`** (after the `get_chex` entry, before the closing `]` at line 157):

```python
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
```

- [ ] **Step 3c: Add `_make_bars_indicator_tool_fn`** immediately after `_make_tool_fn` (after line 302):

```python
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
```

- [ ] **Step 3d: Route the endpoint in `_build_specialist_agent`** — replace the loop body (lines 318–321) so the bars endpoint uses the dedicated function:

```python
    for tool_name in spec["tool_names"]:
        endpoint = _ENDPOINT_BY_NAME[tool_name]
        input_model = _build_input_model(endpoint)
        if tool_name == "get_stock_bars_with_indicators":
            a.tool(_make_bars_indicator_tool_fn(endpoint, input_model))
        else:
            a.tool(_make_tool_fn(endpoint, input_model))
    return a
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest backend/tests/test_chat_specialists.py -k bars_indicator -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/chat.py backend/tests/test_chat_specialists.py
git commit -m "feat: add get_stock_bars_with_indicators tool with hardcoded 60m window"
```

---

## Task 6: Register the Technical Analyst specialist + prompt_extra support

**Files:**
- Modify: `backend/services/chat.py` (extend `_specialist_system_prompt`; append registry entry)
- Test: `backend/tests/test_chat_specialists.py`

- [ ] **Step 1: Write the failing tests**

```python
# Append to backend/tests/test_chat_specialists.py

def test_technical_analyst_registered_with_one_tool():
    spec = next(s for s in chat.SPECIALIST_REGISTRY if s["name"] == "technical_analyst")
    assert spec["tool_names"] == ["get_stock_bars_with_indicators"]
    agent = chat._build_specialist_agent(spec, "openai/gpt-4o-mini")
    assert set(agent._function_toolset.tools.keys()) == {"get_stock_bars_with_indicators"}


def test_prompt_extra_appended_to_specialist_prompt():
    spec = next(s for s in chat.SPECIALIST_REGISTRY if s["name"] == "technical_analyst")
    prompt = chat._specialist_system_prompt(spec)
    assert spec["prompt_extra"] in prompt


def test_specialists_without_prompt_extra_unchanged():
    spec = next(s for s in chat.SPECIALIST_REGISTRY if s["name"] == "exposure")
    prompt = chat._specialist_system_prompt(spec)
    # base template ends here; nothing appended for specialists lacking prompt_extra
    assert prompt.endswith("not shown directly to the end user.")
```

Note: `test_registry_tool_names_resolve_to_endpoint_spec`, `test_specialist_agent_has_exact_tool_subset`, and `test_orchestrator_has_one_delegation_tool_per_specialist` already iterate the registry — they will automatically cover the new entry (delegation tool generation, tool-subset exactness) once it exists.

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run pytest backend/tests/test_chat_specialists.py -k "technical_analyst or prompt_extra" -v`
Expected: FAIL — `StopIteration` (no `technical_analyst` in registry) and the prompt-extra assertion fails (no `prompt_extra` handling yet).

- [ ] **Step 3a: Extend `_specialist_system_prompt`** (replace lines 207–210) to append `prompt_extra` when present:

```python
def _specialist_system_prompt(spec: dict) -> str:
    base = _SPECIALIST_PROMPT_TEMPLATE.format(
        label=spec["label"], description=spec["description"], today=date.today().isoformat()
    )
    extra = spec.get("prompt_extra", "")
    return f"{base} {extra}".rstrip() if extra else base
```

- [ ] **Step 3b: Append the 4th registry entry** to `SPECIALIST_REGISTRY` (after the `market_structure` entry, before the closing `]` at line 249):

```python
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
```

- [ ] **Step 4: Run the full chat test suite to verify everything passes**

Run: `uv run pytest backend/tests/test_chat_specialists.py -v`
Expected: PASS — including the pre-existing registry/delegation tests now covering the 4th specialist.

- [ ] **Step 5: Commit**

```bash
git add backend/services/chat.py backend/tests/test_chat_specialists.py
git commit -m "feat: register Technical Analyst specialist with prompt_extra support"
```

---

## Task 7: Full suite green + manual smoke check

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `uv run pytest -v`
Expected: PASS — all indicator tests and all chat-specialist tests green, no regressions.

- [ ] **Step 2: Sanity-check the orchestrator roster includes the new agent**

Run:
```bash
uv run python -c "from backend.services import chat; print(chat._orchestrator_system_prompt())"
```
Expected: the roster lists `Technical Analyst Agent (\`delegate_to_technical_analyst_agent\`)` alongside the other three.

- [ ] **Step 3: (REQUIRED — verifies the headline goal) live routing smoke test**

The whole point of this feature is that *the orchestrator routes technical-read
questions to the new agent automatically*. No automated test proves this — every
unit test either forces delegation or inspects wiring. Real LLM routing is only
exercised here, so this step is **not optional**.

With `backend/.env` configured (`GEX_ADAPTER=flash_alpha`, `FLASH_ALPHA_API_KEY=...`),
start the backend from repo root and run the frontend:
```bash
uv run uvicorn backend.main:app --reload --port 8000
# in another shell:
cd frontend && npm run dev
```
In the chat, ask: **"Is SPY a long or short right now?"**

Verify all three:
1. The agent trace shows a **`technical_analyst`** row (the orchestrator chose it).
2. It routed to `technical_analyst` and **not** `market_structure` — the two
   descriptions overlap on intraday-ish language (`market_structure` owns "live
   quotes, 0DTE dynamics"; `technical_analyst` owns "intraday momentum"). If it
   mis-routes, tighten one of the two `description` strings in
   `SPECIALIST_REGISTRY` (cheapest fix) and re-test.
3. The answer is a **LONG / SHORT / NEUTRAL** verdict with a confidence and one
   line of evidence citing indicator values.

- [ ] **Step 4: Final commit (only if Step 2/3 surfaced a description/doc tweak; otherwise skip)**

```bash
git add -A
git commit -m "chore: technical analyst agent verification"
```

---

## Self-Review Notes

- **Spec coverage:** Data layer (endpoint spec + dedicated tool fn hardcoding `1m/60`) → Task 5; enriched summary incl. VWAP → Tasks 1–4; indicator definitions (MACD/OBV/CumΔ/VWAP) → Tasks 1–3; edge cases (empty/single/flat/<26 → `window_short`) → Tasks 1–4; specialist registration + `prompt_extra` + orchestrator auto-pickup → Task 6; testing (indicator unit tests, edge cases, registry wiring) → Tasks 1–6; "no frontend files" honored.
- **Type consistency:** function names (`compute_macd`, `compute_obv`, `compute_cumulative_delta`, `compute_vwap`, `build_indicator_summary`, `_make_bars_indicator_tool_fn`) and dict keys (`macd_line`, `signal_line`, `histogram`, `crossover`, `window_short`, `current`, `trend`, `bars_rising`, `bars_falling`, `total`, `latest_bar_delta`, `bias`, `latest`, `close_vs_vwap`, `position`) are used identically across plan and tests.
- **Deviation note (EMA is direction-grade, not ta-lib-parity):** `_ema_series` seeds with the SMA of the first `min(period, len)` closes and then recurses from index 1, so the **entire warm-up region is approximate**, not just the short-window (`< period`) case — it is not a standard ta-lib/talipp EMA. This is intentional and harmless for a direction-only intraday read: a constant series still yields exactly `0.0`, and a sustained ramp is robustly signed well before bar 40 (the bad seed washes out under the `2/(period+1)` decay). **Do not add an exact-value MACD test expecting ta-lib parity** — it will fail. Tests assert exact-zero (flat series) and sign/crossover direction (ramps) only, by design. If precise MACD values are ever required, swap `_ema_series` for a vetted library and update these tests together.
