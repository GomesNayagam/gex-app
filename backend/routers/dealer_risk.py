import logging
import httpx
from fastapi import APIRouter, HTTPException
from backend.config import settings
from backend.models import DealerRisk

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Dealer Risk"])


@router.get("/dealer-risk/{symbol}", response_model=DealerRisk)
async def get_dealer_risk(symbol: str):
    url = f"{settings.flash_alpha_base_url}/flow/dealer-risk/{symbol.upper()}"
    headers = {}
    if settings.flash_alpha_api_key:
        headers["X-API-Key"] = settings.flash_alpha_api_key
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(url, headers=headers)
        if res.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        if not res.is_success:
            raise HTTPException(status_code=502, detail="Upstream error from Flash Alpha")
        return DealerRisk(**res.json())
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Dealer risk fetch failed for %s", symbol)
        raise HTTPException(status_code=502, detail="Upstream error fetching dealer risk")
