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
