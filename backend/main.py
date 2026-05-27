"""
GEX Dashboard — FastAPI Backend v2
===================================
Adapter-driven: set GEX_ADAPTER=seed (default) or GEX_ADAPTER=flash_alpha.
Flash Alpha requires FLASH_ALPHA_API_KEY env var (if the API requires auth).

Run:
    uv run uvicorn backend.main:app --reload --port 8000
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routers import gex, intraday, system
from backend.routers import dealer_risk
from backend.routers import flow_signals
from backend.services import snapshots


def _build_adapter():
    if settings.gex_adapter == "flash_alpha":
        from backend.adapters.flash_alpha import FlashAlphaAdapter
        return FlashAlphaAdapter(), "flash_alpha"
    from backend.adapters.seed import SeedAdapter
    return SeedAdapter(), "seed"


async def _snapshot_loop(app: FastAPI):
    while True:
        await asyncio.sleep(settings.snapshot_interval_seconds)
        adapter = app.state.adapter
        try:
            syms = await adapter.available_symbols()
            for sym in syms:
                try:
                    data = await adapter.fetch(sym, expiry="0dte")
                    snapshots.record(data)
                except Exception:
                    pass
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    adapter, name = _build_adapter()
    app.state.adapter = adapter
    app.state.adapter_name = name
    task = asyncio.create_task(_snapshot_loop(app))
    yield
    task.cancel()
    if hasattr(adapter, "aclose"):
        await adapter.aclose()


app = FastAPI(
    title="GEX Dashboard API",
    description="Gamma Exposure Ladder — adapter-driven (seed | flash_alpha)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(gex.router)
app.include_router(intraday.router)
app.include_router(dealer_risk.router)
app.include_router(flow_signals.router)
