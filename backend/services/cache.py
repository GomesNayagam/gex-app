import time
from typing import Any
from backend.models import InstrumentGEX
from backend.config import settings


class TTLCache:
    def __init__(self):
        self._data: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._data.get(key)
        if entry and time.monotonic() - entry[0] < settings.cache_ttl_seconds:
            return entry[1]
        return None

    def set(self, key: str, value: Any) -> None:
        self._data[key] = (time.monotonic(), value)


cache = TTLCache()
