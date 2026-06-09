import httpx
from datetime import datetime, timezone
from backend.models import (
    InstrumentGEX, Strike, KeyLevel,
    FlowSignalsResponse, FlowSignalsSummary, FlowSignal,
    ScoreBreakdown, SignalEnrichment, ChainContext,
    LeaderboardEntry, LeaderboardResponse,
)
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

    async def fetch(self, symbol: str, expiry: str | None = None, source: str = "flow") -> InstrumentGEX:
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
                today = datetime.today().date().isoformat() if datetime.today().date().isoweekday() < 6 else get_next_monday().isoformat()
                params = {"expiry": today}
            else:
                params = {"expiry": None}

            if source == "exposure":
                resp = await self._client.get(f"/exposure/gex/{sym}")
            else:
                resp = await self._client.get(f"/flow/gex/{sym}", params=params)
                summaryResp = await self._client.get(f"/flow/summary/{sym}", params=params)
            if sym in ["SPX", "SPY", "QQQ"]:
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
        return ["SPX", "SPY", "QQQ"]

    async def fetch_flow_signals(
        self, symbol: str, *, window_minutes: int, min_score: int,
        intent: str | None, structure: str | None, expiry: str | None, limit: int
    ) -> FlowSignalsResponse:
        sym = symbol.upper()
        # Two-stage ranking: pull a wider pool ranked by score from upstream
        # (limit + 15, e.g. 25 for the default display limit of 10), then keep
        # the most recent `limit` within that pool. Capped at the route max (60).
        candidate_limit = min(limit + 15, 60)
        params: dict = {"window_minutes": window_minutes, "min_score": min_score, "limit": candidate_limit}
        if intent:
            params["intent"] = intent
        if structure:
            params["structure"] = structure
        if expiry:
            params["expiry"] = expiry
        resp = await self._client.get(f"/flow/signals/{sym}", params=params)
        resp.raise_for_status()
        data = resp.json()
        chain_raw = data.get("chain") or {}
        chain = ChainContext(
            call_wall=chain_raw.get("call_wall"),
            put_wall=chain_raw.get("put_wall"),
            max_pain=chain_raw.get("max_pain"),
            gamma_flip=chain_raw.get("gamma_flip"),
        )
        raw_signals = sorted(
            data.get("signals") or [],
            key=lambda s: s.get("ts") or "",
            reverse=True,
        )
        signals = [_parse_signal(s) for s in raw_signals[:limit]]
        return FlowSignalsResponse(
            symbol=data.get("symbol", sym),
            as_of=data.get("as_of", datetime.now(timezone.utc).isoformat()),
            underlying_price=data.get("underlying_price", 0.0),
            window_minutes=window_minutes,
            chain=chain,
            count=len(signals),
            signals=signals,
        )

    async def fetch_flow_signals_summary(
        self, symbol: str, *, window_minutes: int, expiry: str | None
    ) -> FlowSignalsSummary:
        sym = symbol.upper()
        params: dict = {"window_minutes": window_minutes}
        if expiry:
            params["expiry"] = expiry
        resp = await self._client.get(f"/flow/signals/{sym}/summary", params=params)
        resp.raise_for_status()
        data = resp.json()
        raw_top = sorted(
            data.get("top_signals") or [],
            key=lambda s: s.get("ts") or "",
            reverse=True,
        )
        top_signals = [_parse_signal(s) for s in raw_top]
        return FlowSignalsSummary(
            symbol=data.get("symbol", sym),
            as_of=data.get("as_of", datetime.now(timezone.utc).isoformat()),
            window_minutes=window_minutes,
            expiry=expiry,
            underlying_price=data.get("underlying_price", 0.0),
            signal_count=data.get("signal_count", 0),
            bullish_premium=data.get("bullish_premium", 0.0),
            bearish_premium=data.get("bearish_premium", 0.0),
            net_directional_premium=data.get("net_directional_premium", 0.0),
            opening_premium=data.get("opening_premium", 0.0),
            closing_premium=data.get("closing_premium", 0.0),
            top_signals=top_signals,
        )

    async def fetch_leaderboard(self, *, window_minutes: int, n: int) -> LeaderboardResponse:
        params = {"windowMinutes": window_minutes, "n": n}
        resp = await self._client.get("/flow/options/leaderboard", params=params)
        resp.raise_for_status()
        data = resp.json()
        buyers = [LeaderboardEntry.model_validate(e) for e in data.get("buyers", [])]
        sellers = [LeaderboardEntry.model_validate(e) for e in data.get("sellers", [])]
        return LeaderboardResponse(
            generatedUtc=data.get("generatedUtc", ""),
            n=data.get("n", n),
            windowMinutes=data.get("windowMinutes", window_minutes),
            buyers=buyers,
            sellers=sellers,
        )

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

def _parse_signal(s: dict) -> FlowSignal:
    bd = s.get("score_breakdown") or {}
    en = s.get("enrichment") or {}
    return FlowSignal(
        ts=s.get("ts", ""),
        expiry=s.get("expiry", ""),
        strike=s.get("strike", 0.0),
        right=s.get("right", ""),
        side=s.get("side", ""),
        price=s.get("price", 0.0),
        size=s.get("size", 0),
        premium=s.get("premium", 0.0),
        dte=s.get("dte", 0),
        structure=s.get("structure", ""),
        aggressor=s.get("aggressor", ""),
        open_close_bias=s.get("open_close_bias", ""),
        open_close_confidence=s.get("open_close_confidence", 0.0),
        contract_net_oi_delta=s.get("contract_net_oi_delta", 0.0),
        intent=s.get("intent", ""),
        score=s.get("score", 0.0),
        conviction=s.get("conviction", ""),
        tags=s.get("tags") or [],
        score_breakdown=ScoreBreakdown(
            premium=bd.get("premium", 0.0),
            size_vs_oi=bd.get("size_vs_oi", 0.0),
            aggressor=bd.get("aggressor", 0.0),
            sweep=bd.get("sweep", 0.0),
            opening_bias=bd.get("opening_bias", 0.0),
            tenor=bd.get("tenor", 0.0),
        ),
        enrichment=SignalEnrichment(
            iv=en.get("iv"),
            delta=en.get("delta"),
            gamma=en.get("gamma"),
            iv_vs_atm=en.get("iv_vs_atm"),
            moneyness=en.get("moneyness"),
            estimated_delta_notional=en.get("estimated_delta_notional"),
            hypothetical_gex_impact_if_opening=en.get("hypothetical_gex_impact_if_opening"),
        ),
    )


def round_flip(sym, n):
    if sym == "SPX":
        return 5 * round(n / 5)
    else:
        return round(n, ndigits=None)