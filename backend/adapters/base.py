from typing import Protocol
from backend.models import InstrumentGEX


class GEXDataAdapter(Protocol):
    async def fetch(self, symbol: str, expiry: str | None = None) -> InstrumentGEX: ...

    async def available_symbols(self) -> list[str]: ...
