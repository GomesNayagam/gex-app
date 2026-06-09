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
