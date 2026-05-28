import asyncio
from fastapi import APIRouter, Request, HTTPException, Query
from backend.models import FlowSignalsResponse, FlowSignalsSummary, LeaderboardResponse
from backend.services.cache import cache

router = APIRouter(prefix="/api/flow", tags=["flow-signals"])


@router.get("/signals/{symbol}", response_model=FlowSignalsResponse)
async def get_flow_signals(
    request: Request,
    symbol: str,
    window_minutes: int = Query(240, ge=1),
    min_score: int = Query(60, ge=0, le=100),
    intent: str | None = Query(None),
    structure: str | None = Query(None),
    expiry: str | None = Query(None),
    limit: int = Query(10, ge=1, le=60),
):
    adapter = request.app.state.adapter
    try:
        return await adapter.fetch_flow_signals(
            symbol.upper(),
            window_minutes=window_minutes,
            min_score=min_score,
            intent=intent,
            structure=structure,
            expiry=expiry,
            limit=limit,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/signals/{symbol}/summary", response_model=FlowSignalsSummary)
async def get_flow_signals_summary(
    request: Request,
    symbol: str,
    window_minutes: int = Query(240, ge=1),
    expiry: str | None = Query(None),
):
    adapter = request.app.state.adapter
    try:
        return await adapter.fetch_flow_signals_summary(
            symbol.upper(),
            window_minutes=window_minutes,
            expiry=expiry,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/signals/watchlist", response_model=list[FlowSignalsSummary])
async def get_flow_watchlist(
    request: Request,
    symbols: str = Query(..., description="Comma-separated symbols"),
    window_minutes: int = Query(240, ge=1),
):
    adapter = request.app.state.adapter
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    tasks = [
        adapter.fetch_flow_signals_summary(sym, window_minutes=window_minutes, expiry=None)
        for sym in syms
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if not isinstance(r, Exception)]


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    request: Request,
    window: int = Query(60, ge=1, le=1440),
    n: int = Query(15, ge=1, le=50),
):
    cache_key = f"leaderboard:{window}:{n}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    adapter = request.app.state.adapter
    try:
        result = await adapter.fetch_leaderboard(window_minutes=window, n=n)
        cache.set(cache_key, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
