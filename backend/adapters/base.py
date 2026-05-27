from typing import Protocol
from backend.models import InstrumentGEX, FlowSignalsResponse, FlowSignalsSummary


class GEXDataAdapter(Protocol):
    async def fetch(self, symbol: str, expiry: str | None = None) -> InstrumentGEX: ...

    async def available_symbols(self) -> list[str]: ...

    async def fetch_flow_signals(
        self, symbol: str, *, window_minutes: int, min_score: int,
        intent: str | None, structure: str | None, expiry: str | None, limit: int
    ) -> FlowSignalsResponse: ...

    async def fetch_flow_signals_summary(
        self, symbol: str, *, window_minutes: int, expiry: str | None
    ) -> FlowSignalsSummary: ...
