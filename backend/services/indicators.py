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
