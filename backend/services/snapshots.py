from collections import deque
from backend.models import GEXSnapshot, IntradaySeries, InstrumentGEX
from backend.config import settings
from datetime import datetime, timezone, timedelta, date, time
from pathlib import Path
from zoneinfo import ZoneInfo
import json

_SNAPSHOT_DIR = Path("backend/data/snapshots")
_store: dict[str, deque[GEXSnapshot]] = {}

_ET = ZoneInfo("America/New_York")
_MARKET_OPEN = time(9, 30)
_MARKET_CLOSE = time(16, 0)


def _is_market_hours() -> bool:
    now_et = datetime.now(_ET)
    # Skip weekends
    if now_et.weekday() >= 5:
        return False
    return _MARKET_OPEN <= now_et.time() <= _MARKET_CLOSE


def _today_et() -> date:
    return datetime.now(_ET).date()


def _today_file() -> Path:
    return _SNAPSHOT_DIR / f"snapshots_{_today_et().isoformat()}.json"


def _load_today() -> None:
    _SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    today = _today_file().name
    for f in _SNAPSHOT_DIR.glob("snapshots_*.json"):
        if f.name != today:
            f.unlink()
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
    if not _is_market_hours():
        return
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


def get_series(symbol: str) -> IntradaySeries:
    sym = symbol.upper()
    snaps = list(_store.get(sym, []))
    # Filter to today's market session (9:30 AM – 4:00 PM ET)
    today_et = _today_et()
    session_start = datetime(today_et.year, today_et.month, today_et.day,
                             _MARKET_OPEN.hour, _MARKET_OPEN.minute,
                             tzinfo=_ET).astimezone(timezone.utc)
    session_end = datetime(today_et.year, today_et.month, today_et.day,
                           _MARKET_CLOSE.hour, _MARKET_CLOSE.minute,
                           tzinfo=_ET).astimezone(timezone.utc)
    snaps = [
        s for s in snaps
        if session_start <= datetime.fromisoformat(s.timestamp) <= session_end
    ]
    return IntradaySeries(symbol=sym, snapshots=snaps)


# Load on module import (happens once per process)
_load_today()
