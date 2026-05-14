from datetime import datetime, timezone
from backend.models import InstrumentGEX, Strike, KeyLevel


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
        call_wall=KeyLevel(strike=7400, gex=17447411310, oi=66639),
        put_wall=KeyLevel(strike=7405, gex=-18119681918, oi=4757),
        strikes=_make_strikes(raw),
        updated_at=datetime.now(timezone.utc).isoformat(),
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
        call_wall=KeyLevel(strike=706, gex=1041003542, oi=10960),
        put_wall=KeyLevel(strike=666, gex=-246915062, oi=109212),
        strikes=_make_strikes(raw),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )


_FACTORIES = {
    "SPX": _seed_spx,
    "SPY": _seed_spy,
    "QQQ": _seed_qqq,
}


class SeedAdapter:
    async def fetch(self, symbol: str, expiry: str | None = None) -> InstrumentGEX:
        sym = symbol.upper()
        if sym not in _FACTORIES:
            raise ValueError(f"Symbol '{sym}' not in seed data")
        return _FACTORIES[sym]()

    async def available_symbols(self) -> list[str]:
        return list(_FACTORIES.keys())
