import httpx
from fastapi import APIRouter, Request
from datetime import datetime, timezone
from backend.models import HealthResponse
from backend.config import settings
from backend.services.cache import cache

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="2.0.0",
    )


@router.get("/api/expirations/{symbol}")
async def get_expirations(symbol: str, request: Request):
    sym = symbol.upper()
    adapter_name = request.app.state.adapter_name

    if adapter_name == "seed":
        return {"symbol": sym, "expirations": [], "message": "Expiration data not available in seed mode"}

    cache_key = f"expirations:{sym}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    headers = {"Accept": "application/json"}
    if settings.flash_alpha_api_key:
        headers["X-API-Key"] = settings.flash_alpha_api_key

    async with httpx.AsyncClient(base_url=settings.flash_alpha_base_url, headers=headers, timeout=10.0) as client:
        resp = await client.get(f"/exposure/gex/{sym}")
        resp.raise_for_status()
        data = resp.json()

    # Extract expirations: prefer top-level list fields, otherwise from strikes
    expirations: list[str] = []
    if "expirations" in data:
        expirations = data["expirations"]
    elif "expiration_dates" in data:
        expirations = data["expiration_dates"]
    elif "strikes" in data:
        seen = set()
        for s in data["strikes"]:
            exp = s.get("expiration")
            if exp and exp not in seen:
                seen.add(exp)
                expirations.append(exp)

    result = {"symbol": sym, "expirations": expirations}
    cache.set(cache_key, result)
    return result
