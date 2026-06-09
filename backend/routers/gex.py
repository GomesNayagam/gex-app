import logging
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone
from backend.models import InstrumentGEX, GEXResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["GEX"])


async def _fetch_cached(request: Request, symbol: str, expiry: str | None = None, source: str = "flow") -> InstrumentGEX:
    from backend.services.cache import cache
    cache_key = f"{symbol}:{expiry}:{source}" if expiry else f"{symbol}:{source}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    adapter = request.app.state.adapter
    data = await adapter.fetch(symbol, expiry=expiry, source=source)
    cache.set(cache_key, data)
    return data


def _filter_strikes(data: InstrumentGEX, n: int) -> InstrumentGEX:
    spot_idx = next((i for i, s in enumerate(data.strikes) if s.is_spot), len(data.strikes) // 2)
    half = n // 2
    lo = max(0, spot_idx - half)
    hi = min(len(data.strikes), spot_idx + half + 1)
    data.strikes = data.strikes[lo:hi]
    return data


@router.get("/gex", response_model=GEXResponse)
async def get_all_gex(
    request: Request,
    strikes: int = Query(default=50, ge=10, le=200, description="Strikes around spot"),
    source: str = Query(default="flow", pattern=r"^(flow|exposure)$"),
):
    adapter = request.app.state.adapter
    symbols = await adapter.available_symbols()
    instruments = []
    for sym in symbols[:3]:  # cap at 3 for the main grid
        try:
            data = await _fetch_cached(request, sym, expiry="0dte", source=source)
            instruments.append(_filter_strikes(data, strikes))
        except Exception as e:
            logger.exception("Upstream fetch failed for %s", sym)
            raise HTTPException(status_code=502, detail="Upstream error fetching GEX data")
    return GEXResponse(
        instruments=instruments,
        as_of=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        source=request.app.state.adapter_name,
    )


@router.get("/gex/{symbol}", response_model=InstrumentGEX)
async def get_gex_by_symbol(
    symbol: str,
    request: Request,
    strikes: Optional[int] = Query(default=None, ge=5, le=200),
    expiry: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$|^0dte$"),
    source: str = Query(default="flow", pattern=r"^(flow|exposure)$"),
):
    try:
        data = await _fetch_cached(request, symbol.upper(), expiry=expiry, source=source)
    except ValueError as e:
        logger.warning("Symbol not found: %s", symbol)
        raise HTTPException(status_code=404, detail="Symbol not found")
    except Exception as e:
        logger.exception("Upstream fetch failed for %s", symbol)
        raise HTTPException(status_code=502, detail="Upstream error fetching GEX data")

    if strikes:
        spot_idx = next((i for i, s in enumerate(data.strikes) if s.is_spot), len(data.strikes) // 2)
        half = strikes // 2
        lo = max(0, spot_idx - half)
        hi = min(len(data.strikes), spot_idx + half + 1)
        data.strikes = data.strikes[lo:hi]

    return data


@router.get("/symbols")
async def list_symbols(request: Request):
    adapter = request.app.state.adapter
    return {"symbols": await adapter.available_symbols()}
