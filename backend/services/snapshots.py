from collections import deque
from backend.models import GEXSnapshot, IntradaySeries, InstrumentGEX
from backend.config import settings
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
import json

_SNAPSHOT_DIR = Path("backend/data/snapshots")
_store: dict[str, deque[GEXSnapshot]] = {}


def _today_file() -> Path:
    return _SNAPSHOT_DIR / f"snapshots_{date.today().isoformat()}.json"


def _load_today() -> None:
    _SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    # Delete any files that are not today's
    today = _today_file().name
    for f in _SNAPSHOT_DIR.glob("snapshots_*.json"):
        if f.name != today:
            f.unlink()
    # Load today's file if it exists
    today_path = _today_file()
    if not today_path.exists():
        return
    try:
        data = json.loads(today_path.read_text())
        for sym, snaps in data.items():
            _store[sym] = deque(
                (GEXSnapshot(**s) for s in snaps),
                maxlen=settings.snapshot_max_per_symbol,
            )
    except Exception:
        pass


def _persist() -> None:
    try:
        data = {sym: [s.model_dump() for s in snaps] for sym, snaps in _store.items()}
        _today_file().write_text(json.dumps(data))
    except Exception:
        pass


def record(instrument: InstrumentGEX) -> None:
    sym = instrument.symbol
    if sym not in _store:
        _store[sym] = deque(maxlen=settings.snapshot_max_per_symbol)
    _store[sym].append(GEXSnapshot(
        timestamp=datetime.now(timezone.utc).isoformat(),
        spot=instrument.spot,
        net_gex=instrument.net_gex,
        flip=instrument.flip,
        call_wall_strike=instrument.call_wall.strike,
        put_wall_strike=instrument.put_wall.strike,
    ))
    _persist()


def get_series(symbol: str, lookback_hours: float = 6.0) -> IntradaySeries:
    sym = symbol.upper()
    snaps = list(_store.get(sym, []))
    if lookback_hours > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
        snaps = [s for s in snaps if datetime.fromisoformat(s.timestamp) >= cutoff]
    return IntradaySeries(symbol=sym, snapshots=snaps)


# Load on module import (happens once per process)
_load_today()
