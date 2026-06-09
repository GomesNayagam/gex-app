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
