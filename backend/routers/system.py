from fastapi import APIRouter
from datetime import datetime, timezone
from backend.models import HealthResponse

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="2.0.0",
    )
