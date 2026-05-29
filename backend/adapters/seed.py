from datetime import datetime, timezone
from backend.models import (
    InstrumentGEX, Strike, KeyLevel,
    FlowSignalsResponse, FlowSignalsSummary, FlowSignal,
    ScoreBreakdown, SignalEnrichment, ChainContext,
    LeaderboardEntry, LeaderboardResponse,
)


def _make_strikes(raw: list[tuple]) -> list[Strike]:
    return [
        Strike(strike=s, call_gex=cg, put_gex=pg, net_gex=ng, is_flip=flip, is_spot=spot)
        for s, cg, pg, ng, flip, spot in raw
    ]


def _seed_spx() -> InstrumentGEX:
    raw = [
        (7350, 3084067664.3,  -2358556568.3,   725511096.0, False, False),
        (7355,  441582180.0,   -604953255.8,  -163371075.8, False, False),
        (7360, 1352933034.6,   -710471905.2,   642461129.4, False, False),
        (7365,  460646888.0,   -554094117.0,   -93447229.1, False, False),
        (7370, 1863157224.1,  -1414608785.4,   448548438.8, False, False),
        (7375, 2496945918.0,  -1514824684.2,   982121233.8, False, False),
        (7380, 1273761486.0,  -1068085892.7,   205675593.3, False, False),
        (7385, 1053425935.4,   -400504469.4,   652921466.0, False, False),
        (7390, 1838583810.4,   -789068719.1,  1049515091.3, False, False),
        (7395, 1675905102.3,  -1081539668.9,   594365433.4, False, False),
        (7400,17447411310.2, -16738330591.6,   709080718.7, True,  False),
        (7405, 5859655180.5, -18119681917.9,-12260026737.3, False, False),
        (7410, 5561503852.8,  -6209497769.0,  -647993916.2, False, False),
        (7415, 5013638660.9,  -3527150611.0,  1486488049.8, False, False),
        (7420, 4988064367.6,   -882375534.1,  4105688833.5, False, True ),
        (7425, 5264738775.6,  -1035666195.8,  4229072579.7, False, False),
        (7430, 3550307954.4,   -449035817.6,  3101272136.8, False, False),
        (7435, 1478858043.7,   -285344846.6,  1193513197.1, False, False),
        (7440, 2360849970.6,   -333413129.5,  2027436841.1, False, False),
        (7445, 2356103931.0,   -117973593.8,  2238130337.2, False, False),
        (7450, 7962804901.5,   -840987124.2,  7121817777.4, False, False),
    ]
    return InstrumentGEX(
        symbol="SPX", spot=7420.0, flip=7400.273, net_gex=53277292807,
        regime="Positive",
        call_wall=KeyLevel(strike=7450, gex=17447411310, oi=66639),
        put_wall=KeyLevel(strike=7405, gex=-18119681918, oi=4757),
        strikes=_make_strikes(raw),
        updated_at=datetime.now(timezone.utc).isoformat(),
        flow_direction="amplification",
        net_chex=123.45,
        net_vex=-123.45
    )


def _seed_spy() -> InstrumentGEX:
    raw = [
        (729,   50955709.0,  -121073127.9,   -70117418.9, False, False),
        (730,   76142538.3,   -75728444.8,      414093.5,  False, False),
        (731,  130676914.2,  -185976274.6,   -55299360.4, False, False),
        (732,  124335715.7,   -52696194.3,    71639521.4,  False, False),
        (733,  127583210.1,  -810242417.7,  -682659207.5, False, False),
        (734,   22910007.7,  -233466884.2,  -210556876.6, False, False),
        (735,   52416632.7,    -6897650.4,    45518982.3,  False, False),
        (736,   81569634.1,  -169887266.7,   -88317632.6, False, False),
        (737,  113146374.8,  -140195391.1,   -27049016.3, True,  False),
        (738, 1703741135.0,   -90844162.0,  1612896973.1, False, False),
        (739, 7644896093.5,  -166885126.7,  7478010966.8, False, True ),
        (740,   83984289.6,   -52299275.3,    31685014.3,  False, False),
        (741,  177309898.8,   -46676874.2,   130633024.6, False, False),
        (742,  432563207.2,   -41003334.5,   391559872.7, False, False),
        (743,  105059880.4,   -70433420.2,    34626460.2,  False, False),
        (744,   31398191.3,   -43544904.6,   -12146713.3, False, False),
        (745,  387149953.4,   -49183120.9,   337966832.5, False, False),
        (746,   80386417.2,  -168628993.8,   -88242576.5, False, False),
        (747,   52505924.7,    -7010017.6,    45495907.1,  False, False),
        (748,   18461120.0,   -32003047.2,   -13541927.2, False, False),
        (749,   46318694.4,    -8526922.9,    37791771.5,  False, False),
    ]
    return InstrumentGEX(
        symbol="SPY", spot=739.6949999999999, flip=737.016, net_gex=7519344849,
        regime="Positive",
        call_wall=KeyLevel(strike=739, gex=7644896094, oi=53413),
        put_wall=KeyLevel(strike=733, gex=-810242418, oi=50138),
        strikes=_make_strikes(raw),
        updated_at=datetime.now(timezone.utc).isoformat(),
        flow_direction='neutral',
        net_chex=-123.45,
        net_vex=123.45
    )


def _seed_qqq() -> InstrumentGEX:
    raw = [
        (701,   75053209.9,   -61600474.9,    13452735.0,  False, False),
        (702,   77699280.1,   -84779947.9,    -7080667.8,  False, False),
        (703,   87683501.9,   -73391122.2,    14292379.7,  False, False),
        (704,  897318682.8,   -77972778.5,   819345904.2, False, False),
        (705,  704893934.5,  -253267416.0,   451626518.5, False, False),
        (706, 1041003542.0,  -230288267.0,   810715275.0, True,  False),
        (707,  494826506.5,  -879763462.3,  -384936955.8, False, False),
        (708,  240347573.0,  -769172998.8,  -528825425.8, False, False),
        (709,  167575273.1,  -536329368.4,  -368754095.3, False, False),
        (710,  119149245.1,   -91401401.8,    27747843.3,  False, False),
        (711,  236346984.7,  -170342523.8,    66004460.8,  False, False),
        (712,  105325158.5,  -329965731.4,  -224640572.9, False, True ),
        (713,  333003115.6,  -183228915.4,   149774200.2, False, False),
        (714,   58852889.1,   -39869990.5,    18982898.6,  False, False),
        (715,   62581353.7,   -37838883.4,    24742470.3,  False, False),
        (716,   92198591.0,   -25343696.8,    66854894.2,  False, False),
        (717,  299760118.6,   -21955454.7,   277804663.9, False, False),
        (718,   61061400.8,   -10459262.0,    50602138.8,  False, False),
        (719,   50558484.6,   -27371750.1,    23186734.4,  False, False),
        (720,   72667425.1,  -124208912.8,   -51541487.7, False, False),
        (721,  113020690.4,   -16467750.3,    96552940.0,  False, False),
    ]
    return InstrumentGEX(
        symbol="QQQ", spot=711.91, flip=706.678, net_gex=677834355,
        regime="Positive",
        call_wall=KeyLevel(strike=717, gex=1041003542, oi=10960),
        put_wall=KeyLevel(strike=707, gex=-246915062, oi=109212),
        strikes=_make_strikes(raw),
        updated_at=datetime.now(timezone.utc).isoformat(),
        flow_direction="no_flow",
        net_chex=123.45,
        net_vex=123.45
    )


_FACTORIES = {
    "SPX": _seed_spx,
    "SPY": _seed_spy,
    "QQQ": _seed_qqq,
}


_SEED_SIGNALS = [
    FlowSignal(
        ts="2026-05-25T12:03:14Z", expiry="2026-06-21", strike=5850.0, right="C",
        side="buy", price=4.20, size=1200, premium=504000.0, dte=28,
        structure="sweep", aggressor="above_ask",
        open_close_bias="open", open_close_confidence=0.92, contract_net_oi_delta=850.0,
        intent="bullish", score=92.0, conviction="high",
        tags=["whale", "golden", "sweep", "opening"],
        score_breakdown=ScoreBreakdown(premium=18, size_vs_oi=16, aggressor=14, sweep=20, opening_bias=14, tenor=10),
        enrichment=SignalEnrichment(iv=0.182, delta=0.42, gamma=0.012, iv_vs_atm=1.4, moneyness="OTM",
                                    estimated_delta_notional=50400000.0, hypothetical_gex_impact_if_opening=1800000.0),
    ),
    FlowSignal(
        ts="2026-05-25T12:01:58Z", expiry="2026-05-31", strike=5800.0, right="P",
        side="buy", price=9.10, size=600, premium=546000.0, dte=7,
        structure="sweep", aggressor="at_ask",
        open_close_bias="open", open_close_confidence=0.78, contract_net_oi_delta=410.0,
        intent="bearish", score=84.0, conviction="high",
        tags=["golden", "sweep", "opening"],
        score_breakdown=ScoreBreakdown(premium=15, size_vs_oi=14, aggressor=16, sweep=18, opening_bias=12, tenor=9),
        enrichment=SignalEnrichment(iv=0.215, delta=-0.38, gamma=0.018, iv_vs_atm=2.1, moneyness="OTM"),
    ),
    FlowSignal(
        ts="2026-05-25T11:58:42Z", expiry="2026-06-21", strike=5900.0, right="C",
        side="buy", price=2.80, size=800, premium=224000.0, dte=28,
        structure="block", aggressor="at_ask",
        open_close_bias="close", open_close_confidence=0.65, contract_net_oi_delta=-120.0,
        intent="bullish", score=71.0, conviction="medium",
        tags=["block", "closing"],
        score_breakdown=ScoreBreakdown(premium=12, size_vs_oi=10, aggressor=14, sweep=10, opening_bias=15, tenor=10),
        enrichment=SignalEnrichment(iv=0.165, delta=0.28, gamma=0.009, moneyness="OTM"),
    ),
]


def _seed_flow_signals_spx() -> FlowSignalsResponse:
    now = datetime.now(timezone.utc).isoformat()
    return FlowSignalsResponse(
        symbol="SPX", as_of=now, underlying_price=5832.40,
        window_minutes=240,
        chain=ChainContext(call_wall=5850.0, put_wall=5780.0, max_pain=5820.0, gamma_flip=5820.0),
        count=len(_SEED_SIGNALS), signals=_SEED_SIGNALS,
    )


def _seed_flow_summary_spx() -> FlowSignalsSummary:
    now = datetime.now(timezone.utc).isoformat()
    return FlowSignalsSummary(
        symbol="SPX", as_of=now, window_minutes=240, expiry=None,
        underlying_price=5832.40, signal_count=14,
        bullish_premium=18200000.0, bearish_premium=6400000.0,
        net_directional_premium=11800000.0,
        opening_premium=21300000.0, closing_premium=3400000.0,
        top_signals=_SEED_SIGNALS[:2],
    )


class SeedAdapter:
    async def fetch(self, symbol: str, expiry: str | None = None) -> InstrumentGEX:
        sym = symbol.upper()
        if sym not in _FACTORIES:
            raise ValueError(f"Symbol '{sym}' not in seed data")
        return _FACTORIES[sym]()

    async def available_symbols(self) -> list[str]:
        return list(_FACTORIES.keys())

    async def fetch_flow_signals(
        self, symbol: str, *, window_minutes: int, min_score: int,
        intent: str | None, structure: str | None, expiry: str | None, limit: int
    ) -> FlowSignalsResponse:
        result = _seed_flow_signals_spx()
        filtered = [s for s in result.signals if s.score >= min_score]
        if intent:
            filtered = [s for s in filtered if s.intent == intent]
        if structure:
            filtered = [s for s in filtered if s.structure == structure]
        # Two-stage ranking (mirrors flash_alpha): take a wider score-ranked
        # pool, then keep the most recent `limit` within it, newest-first.
        candidate_limit = min(limit + 15, 60)
        pool = sorted(filtered, key=lambda s: s.score, reverse=True)[:candidate_limit]
        filtered = sorted(pool, key=lambda s: s.ts or "", reverse=True)[:limit]
        return FlowSignalsResponse(
            symbol=result.symbol, as_of=result.as_of, underlying_price=result.underlying_price,
            window_minutes=window_minutes, chain=result.chain,
            count=len(filtered), signals=filtered,
        )

    async def fetch_flow_signals_summary(
        self, symbol: str, *, window_minutes: int, expiry: str | None
    ) -> FlowSignalsSummary:
        return _seed_flow_summary_spx()

    async def fetch_leaderboard(self, *, window_minutes: int, n: int) -> LeaderboardResponse:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        buyers = [
            LeaderboardEntry(symbol="AMD",  net_volume=7882,  net_notional=19805114.0, buy_volume=20184, sell_volume=12302, avg_premium=25.13, trade_count=15472, last_trade_utc=now),
            LeaderboardEntry(symbol="MU",   net_volume=2662,  net_notional=13143444.0, buy_volume=16314, sell_volume=13652, avg_premium=49.37, trade_count=24596, last_trade_utc=now),
            LeaderboardEntry(symbol="NVDA", net_volume=1800,  net_notional=9200000.0,  buy_volume=10000, sell_volume=8200,  avg_premium=51.11, trade_count=12000, last_trade_utc=now),
            LeaderboardEntry(symbol="AAPL", net_volume=950,   net_notional=4100000.0,  buy_volume=5500,  sell_volume=4550,  avg_premium=43.16, trade_count=8200,  last_trade_utc=now),
            LeaderboardEntry(symbol="GOOGL",net_volume=620,   net_notional=3400000.0,  buy_volume=3800,  sell_volume=3180,  avg_premium=54.84, trade_count=5600,  last_trade_utc=now),
        ]
        sellers = [
            LeaderboardEntry(symbol="SPY",  net_volume=-64812, net_notional=-14035074.0, buy_volume=381580, sell_volume=446392, avg_premium=2.17,   trade_count=96371, last_trade_utc=now),
            LeaderboardEntry(symbol="SPX",  net_volume=-652,   net_notional=-12567596.0, buy_volume=7349,   sell_volume=8001,   avg_premium=192.75, trade_count=4534,  last_trade_utc=now),
            LeaderboardEntry(symbol="TSLA", net_volume=-3200,  net_notional=-6400000.0,  buy_volume=14000,  sell_volume=17200,  avg_premium=20.0,   trade_count=18000, last_trade_utc=now),
            LeaderboardEntry(symbol="META", net_volume=-1400,  net_notional=-3200000.0,  buy_volume=7200,   sell_volume=8600,   avg_premium=22.86,  trade_count=9800,  last_trade_utc=now),
            LeaderboardEntry(symbol="IWM",  net_volume=-900,   net_notional=-1900000.0,  buy_volume=4900,   sell_volume=5800,   avg_premium=21.11,  trade_count=6200,  last_trade_utc=now),
        ]
        return LeaderboardResponse(generatedUtc=now, n=n, windowMinutes=window_minutes, buyers=buyers, sellers=sellers)
