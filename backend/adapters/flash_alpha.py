import httpx
from datetime import datetime, timezone
from backend.models import InstrumentGEX, Strike, KeyLevel
from backend.config import settings
from datetime import date, timedelta


class FlashAlphaAdapter:
    def __init__(self):
        headers = {"Accept": "application/json"}
        if settings.flash_alpha_api_key:
            headers["X-API-Key"] = settings.flash_alpha_api_key
        self._client = httpx.AsyncClient(
            base_url=settings.flash_alpha_base_url,
            headers=headers,
            timeout=10.0,
        )

    async def fetch(self, symbol: str, expiry: str | None = None) -> InstrumentGEX:
        sym = symbol.upper()
        summaryResp = None
        chexResp = None
        vexResp = None
        # Route to /exposure/gex/{symbol}?expiration={expiry} for ISO date expiries
        if expiry and expiry != "0dte":
            params = {"expiration": expiry}
            resp = await self._client.get(f"/exposure/gex/{sym}", params=params)
            chexResp = await self._client.get(f"/exposure/chex/{sym}", params=params)
            vexResp = await self._client.get(f"/exposure/vex/{sym}", params=params)
            resp.raise_for_status()
        else:
            if expiry and expiry == "0dte":
                # lets check is weekend, if so pass next monday
                today = datetime.today().date().isoformat() if datetime.today().date().isoweekday() < 6 else get_next_monday().isoformat()
                #params = {"expiry": (datetime.today().date().isoformat())}
                params = {"expiry": today}
            else:
                params = {"expiry": None}
               
            resp = await self._client.get(f"/flow/gex/{sym}", params=params)
            summaryResp = await self._client.get(f"/flow/summary/{sym}", params=params)
            if sym in ["SPX","SPY","QQQ"]:
                            chexResp = await self._client.get(f"/exposure/chex/{sym}", params=params)
                            vexResp = await self._client.get(f"/exposure/vex/{sym}", params=params)
            resp.raise_for_status()


        data = resp.json()
        spot = data["underlying_price"]
        # /flow returns live_gamma_flip; /exposure returns gamma_flip
        flip = data.get("live_gamma_flip") or data["gamma_flip"]
        # round flip to 1 decimal for option
        flip = round_flip(sym=sym, n=flip) if flip else 0.0
        net_gex = data.get("live_net_gex") or data["net_gex"]
        regime = (data.get("live_net_gex_label") or data["net_gex_label"]).capitalize()
        flow_direction =  summaryResp.json().get("flow_direction") if summaryResp else "na"
        l_net_chex = chexResp.json().get("net_chex") if chexResp else 0.0
        l_net_vex = vexResp.json().get("net_vex") if vexResp else 0.0

        raw_strikes = data["strikes"]
        spot_strike = min(raw_strikes, key=lambda x: abs(x["strike"] - spot))["strike"]
        flip_strike = min(raw_strikes, key=lambda x: abs(x["strike"] - flip))["strike"]

        strikes: list[Strike] = []
        for s in raw_strikes:
            strikes.append(Strike(
                strike=s["strike"],
                call_gex=s["call_gex"],
                put_gex=s["put_gex"],
                net_gex=s["net_gex"],
                call_oi=s.get("call_oi") or 0,
                put_oi=s.get("put_oi") or 0,
                call_volume=s.get("call_volume") or 0,
                put_volume=s.get("put_volume") or 0,
                call_oi_change=s.get("call_oi_change"),
                put_oi_change=s.get("put_oi_change"),
                is_flip=s["strike"] == flip_strike,
                is_spot=s["strike"] == spot_strike,
            ))

        call_wall = _find_call_wall(strikes, spot)
        put_wall = _find_put_wall(strikes, spot)

        return InstrumentGEX(
            symbol=data["symbol"],
            spot=spot,
            flip=flip,
            net_gex=net_gex,
            regime=regime,
            call_wall=call_wall,
            put_wall=put_wall,
            strikes=strikes,
            updated_at=data.get("as_of") or datetime.now(timezone.utc).isoformat(),
            flow_direction=flow_direction,
            net_chex = l_net_chex,
            net_vex = l_net_vex
        )

    async def available_symbols(self) -> list[str]:
        # Flash Alpha supports any symbol; return common defaults
        return ["SPX", "SPY", "QQQ"]

    async def aclose(self):
        await self._client.aclose()


def _find_call_wall(strikes: list[Strike], spot: float) -> KeyLevel:
    above = [s for s in strikes if s.strike >= spot]
    if not above:
        above = strikes
    best = max(above, key=lambda s: s.call_gex)
    return KeyLevel(strike=best.strike, gex=best.call_gex, oi=best.call_oi)


def _find_put_wall(strikes: list[Strike], spot: float) -> KeyLevel:
    below = [s for s in strikes if s.strike <= spot]
    if not below:
        below = strikes
    best = min(below, key=lambda s: s.put_gex)  # most negative
    return KeyLevel(strike=best.strike, gex=best.put_gex, oi=best.put_oi)

def get_next_monday():
    today = date.today()
    # weekday() returns 0 for Monday, 6 for Sunday
    days_ahead = 0 - today.weekday()
    if days_ahead <= 0: # Target is today or has passed this week
        days_ahead += 7
    return today + timedelta(days_ahead)

def round_flip(sym, n):
    if sym == "SPX":
        return 5 * round(n / 5)
    else:
        return round(n, ndigits=None)