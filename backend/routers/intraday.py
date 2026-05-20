from fastapi import APIRouter
from backend.models import IntradaySeries
from backend.services import snapshots

router = APIRouter(prefix="/api", tags=["Intraday"])


@router.get("/gex/{symbol}/intraday", response_model=IntradaySeries)
def get_intraday(symbol: str):
    return snapshots.get_series(symbol.upper())
