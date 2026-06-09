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
