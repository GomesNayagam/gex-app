# Unusual Options Activity (UOA) — Plan

## Context

Add a new top-level view, **Unusual Option Activity** (UOA), that surfaces high-conviction options flow for day traders. Driven by Flash Alpha's pre-scored signal API (`/flow/signals/{symbol}` and `/flow/signals/{symbol}/summary`), the same approach used in the referenced Medium scanner. Goal: a glanceable institutional-grade tape that ranks signals by composite score, exposes the per-component breakdown (premium / size-vs-OI / aggressor / sweep / opening-bias / tenor), and lets traders filter by intent, structure, score, and 0DTE — all alongside the existing GEX context (call wall / put wall / γ flip) the app already shows.

This plan saves to `.claude/plans/` per CLAUDE.md (note: existing convention `{sequence}-{plan-name}.md` → rename to `2-unusual-option-activity.md` once approved; this file will then be moved).

---

## Key concepts (distilled from the article + Flash Alpha docs)

What matters for a day trader, in priority order:

1. **Composite score (0–100)** — Flash Alpha's pre-computed conviction. Default cutoff `minScore=60`.
2. **Score breakdown** — the *differentiator*. The article is explicit: "if your renderer just shows the composite, you've thrown away the differentiator." Show all six components: `premium`, `size_vs_oi`, `aggressor`, `sweep`, `opening_bias`, `tenor`.
3. **Intent** — bullish / bearish / neutral.
4. **Structure** — `sweep` (multi-level urgency) vs `block`.
5. **Aggressor** — `above_ask` / `at_ask` / `mid` / `at_bid` / `below_bid` (who pressed).
6. **Open/close bias + confidence** — opening positions ≈ fresh conviction; closing ≈ unwinds.
7. **Tags** — especially `whale` (≥ $1M sweep, score ≥ 70) and `golden` (top-decile + score ≥ 70).
8. **Contract context** — strike, right (C/P), expiry, DTE, price, size, premium, side.
9. **Chain context** — `call_wall`, `put_wall`, `max_pain`, `gamma_flip` (returned by `/signals`) — anchors the trade against dealer positioning we already render.
10. **Enrichment** — IV, δ, γ, IV vs ATM, moneyness (ITM/ATM/OTM), `estimated_delta_notional`, `hypothetical_gex_impact_if_opening`.
11. **Summary aggregates** (per symbol over window): `signal_count`, `bullish_premium`, `bearish_premium`, `net_directional_premium`, `opening_premium`, `closing_premium`.

---

## Architecture

### Backend (`backend/`)

**New router** — `backend/routers/flow_signals.py`

- `GET /api/flow/signals/{symbol}` — proxies `/v1/flow/signals/{symbol}`. Query params: `window_minutes` (default 240), `min_score` (default 60), `intent`, `structure`, `expiry`, `limit` (default 50).
- `GET /api/flow/signals/{symbol}/summary` — proxies `/v1/flow/signals/{symbol}/summary`. Query params: `window_minutes`, `expiry`.
- `GET /api/flow/signals/watchlist?symbols=SPX,SPY,...&window_minutes=240` — parallel fan-out of `/summary` calls for the multi-symbol scanner row.

Mount in `backend/main.py` next to existing `gex`, `intraday`, `dealer_risk`, `system` routers.

**New adapter methods** — extend `backend/adapters/base.py` Protocol and implement in both adapters:

```python
class GEXDataAdapter(Protocol):
    async def fetch_flow_signals(self, symbol: str, *, window_minutes: int, min_score: int,
                                 intent: str | None, structure: str | None,
                                 expiry: str | None, limit: int) -> FlowSignalsResponse: ...
    async def fetch_flow_signals_summary(self, symbol: str, *, window_minutes: int,
                                         expiry: str | None) -> FlowSignalsSummary: ...
```

- `flash_alpha.py` — pass-through to `/v1/flow/signals/{symbol}` and `/v1/flow/signals/{symbol}/summary` via the existing `httpx.AsyncClient` (reuses `X-API-Key` header and `FLASH_ALPHA_BASE_URL`). Tolerate missing optional fields with `.get()` fallbacks — same defensive pattern as the existing GEX adapter (CLAUDE.md flags field-name drift between `/flow` and `/exposure`).
- `seed.py` — return a small hand-built signal set so the UI runs without an API key (mirrors existing `SeedAdapter` philosophy).

**New models** — `backend/models.py` (additions):

```python
class ScoreBreakdown(BaseModel):
    premium: float; size_vs_oi: float; aggressor: float
    sweep: float; opening_bias: float; tenor: float

class SignalEnrichment(BaseModel):
    iv: float | None = None; delta: float | None = None; gamma: float | None = None
    iv_vs_atm: float | None = None; moneyness: str | None = None
    estimated_delta_notional: float | None = None
    hypothetical_gex_impact_if_opening: float | None = None

class ChainContext(BaseModel):
    call_wall: float | None = None; put_wall: float | None = None
    max_pain: float | None = None; gamma_flip: float | None = None

class FlowSignal(BaseModel):
    ts: str; expiry: str; strike: float; right: str; side: str
    price: float; size: int; premium: float; dte: int
    structure: str; aggressor: str
    open_close_bias: str; open_close_confidence: float
    contract_net_oi_delta: float; intent: str
    score: float; conviction: str; tags: list[str]
    score_breakdown: ScoreBreakdown; enrichment: SignalEnrichment

class FlowSignalsResponse(BaseModel):
    symbol: str; as_of: str; underlying_price: float
    window_minutes: int; chain: ChainContext
    count: int; signals: list[FlowSignal]

class FlowSignalsSummary(BaseModel):
    symbol: str; as_of: str; window_minutes: int; expiry: str | None
    underlying_price: float; signal_count: int
    bullish_premium: float; bearish_premium: float; net_directional_premium: float
    opening_premium: float; closing_premium: float
    top_signals: list[FlowSignal]
```

**Cache** — reuse `backend/services/cache.py` with 30s TTL keyed by full param tuple. Signals are time-windowed; short TTL keeps live feel without hammering the API.

### Frontend (`frontend/src/`)

**New route** — `/uoa` → `views/UOAMode.jsx`. Register in `App.jsx` next to existing routes. Add a `Sidebar` nav entry ("UOA" with a `Flame` or `Activity` lucide icon).

**New api.js helpers**:
```js
export const fetchFlowSignals = (symbol, opts) => ...
export const fetchFlowSummary = (symbol, opts) => ...
export const fetchFlowWatchlist = (symbols, opts) => ...
```

**New hook** — `hooks/useFlowSignals.js` — 30s polling (matches existing GEX cadence), exposes `{ data, loading, error, refresh, setFilters }`. Filters persisted to localStorage under `uoa-filters`.

**Components** (all new under `components/uoa/`):

- `UOATopBar.jsx` — symbol selector (reuses watchlist), window-minutes pill (60 / 240 / 1d), min-score slider (0–100, default 60), intent toggle (all / bullish / bearish), structure toggle (all / sweep / block), 0DTE toggle, expiry picker.
- `UOASummaryStrip.jsx` — sticky strip below top bar: spot, signal count, bullish vs bearish premium ratio (mini horizontal bar), opening vs closing premium ratio, net directional premium, last-updated.
- `SignalTape.jsx` — virtualised list of `SignalRow` (use existing list patterns; recharts not needed here).
- `SignalRow.jsx` — single row, see UI mockup below.
- `ScoreBreakdownBar.jsx` — stacked horizontal bar showing the six component contributions summing to the composite score; hover tooltip per segment.
- `SignalDetailDrawer.jsx` — right-side drawer on row click: full enrichment (IV/δ/γ, IV vs ATM, moneyness, delta-notional, hypothetical GEX impact), chain context anchors (call wall / put wall / γ flip relative to strike), raw JSON toggle.

Reuse existing primitives: `components/ui/{card,badge,button,tabs,skeleton}.jsx`, `lib/format.js` (extend with `fmtPremium`, `fmtScore`, `fmtMoneyness`), `lib/utils.js` (`cn`).

---

## UI design — institutional-grade mockup

Style continuity with the rest of the app: monospace numerics, Tailwind CSS variables (`--surface-1`, `--text-1/2/3`, `--border`), thin borders, no chrome. Inspired by Bloomberg TOMS / Flow X tape views.

### Layout (ASCII spec — to be rendered as actual HTML mockup in step 1)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UOA  [SPX▾] [240m▾] minScore:[━━━━●━━━] 60  Intent:[ALL|BULL|BEAR]           │
│                              Structure:[ALL|SWEEP|BLOCK]  [0DTE] [⟳] 12:04ET │
├──────────────────────────────────────────────────────────────────────────────┤
│ SPX  5,832.40  ·  Signals 14  ·  Bull █████████░░░ $18.2M  Bear ███░ $6.4M   │
│                              Net +$11.8M  ·  Opening $21.3M  Closing $3.4M   │
├──────────────────────────────────────────────────────────────────────────────┤
│ SCORE │ TIME    │ CONTRACT             │ FLOW                  │ BREAKDOWN   │
│ ─────────────────────────────────────────────────────────────────────────── │
│  92●  │ 12:03:14│ SPX 5850 C  06-21 28d│ SWEEP ▲ above_ask     │ ████▌███▍██ │
│  ▲BULL│         │ $4.20 × 1,200 = $504K│ OPEN ●0.92  +OI 850   │ P S A W O T │
│ [whale][golden][sweep][opening]                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│  84●  │ 12:01:58│ SPX 5800 P  05-31  7d│ SWEEP ▼ at_ask        │ ███▌██▍███▍ │
│  ▼BEAR│         │ $9.10 × 600 = $546K  │ OPEN ●0.78  +OI 410   │             │
│ [golden][sweep][opening]                                                     │
│ ─────────────────────────────────────────────────────────────────────────── │
│  71●  │ 11:58:42│ SPX 5900 C  06-21 28d│ BLOCK  ▲ at_ask       │ ██▌█▍██▍██  │
│  ▲BULL│         │ $2.80 × 800 = $224K  │ CLOSE ●0.65  −OI 120  │             │
│ [block][closing]                                                             │
│ ─────────────────────────────────────────────────────────────────────────── │
│  ...                                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

Detail drawer (right slide-over) shows enrichment + chain context:

```
SPX 5850 C  06-21 (28 DTE)            ✕
─────────────────────────────────────
SCORE 92            CONVICTION  high
breakdown:
  premium      18 ████▌
  size_vs_oi   16 ████
  aggressor    14 ███▌
  sweep        20 █████
  opening_bias 14 ███▌
  tenor        10 ██▌
─────────────────────────────────────
GREEKS    IV 18.2%   δ 0.42   γ 0.012
          IV vs ATM  +1.4 vol
          moneyness  OTM
NOTIONAL  δ-notional  $50.4M
          GEX impact (if opening) +$1.8M γ$
─────────────────────────────────────
CHAIN CTX  spot 5832.40
           call wall 5850   ← at strike
           put wall  5780
           γ flip    5820
─────────────────────────────────────
TAGS  [whale] [golden] [sweep] [opening]
[ Show raw JSON ▾ ]
```

### Visual rules

- **Score chip**: 0–59 muted, 60–79 amber, 80–89 blue, 90+ green; small filled disc indicator.
- **Intent**: `▲BULL` green, `▼BEAR` red, `●NEUT` muted.
- **Aggressor glyphs**: `above_ask` ⇧⇧, `at_ask` ⇧, `mid` ◆, `at_bid` ⇩, `below_bid` ⇩⇩.
- **Breakdown bar**: 6 fixed-width segments, hover reveals component values. The six-letter legend `P S A W O T` aligns under the bar.
- **Tags**: `whale` gold border, `golden` solid gold, `sweep` blue, `opening`/`closing` neutral.
- **Row density**: 2 lines per row by default; one-line compact mode toggle in top bar.
- **Numerics**: `tabular-nums font-mono`, premiums in `$Xk/$XM` (extend `lib/format.js`).
- **Empty state**: "No signals match — lower minScore or widen window." (CLAUDE.md tone matches.)

---

## Critical files to be modified / added

**Backend**
- `backend/models.py` — add models above
- `backend/adapters/base.py` — extend Protocol
- `backend/adapters/flash_alpha.py` — add `fetch_flow_signals`, `fetch_flow_signals_summary`
- `backend/adapters/seed.py` — add demo signal data
- `backend/routers/flow_signals.py` — **new**
- `backend/main.py` — mount new router
- `backend/services/cache.py` — reuse, no change

**Frontend**
- `frontend/src/App.jsx` — register `/uoa` route
- `frontend/src/components/shell/Sidebar.jsx` — add UOA nav entry
- `frontend/src/api.js` — add fetch helpers
- `frontend/src/lib/format.js` — add `fmtPremium`, `fmtScore`
- `frontend/src/hooks/useFlowSignals.js` — **new**
- `frontend/src/views/UOAMode.jsx` — **new**
- `frontend/src/components/uoa/UOATopBar.jsx` — **new**
- `frontend/src/components/uoa/UOASummaryStrip.jsx` — **new**
- `frontend/src/components/uoa/SignalTape.jsx` — **new**
- `frontend/src/components/uoa/SignalRow.jsx` — **new**
- `frontend/src/components/uoa/ScoreBreakdownBar.jsx` — **new**
- `frontend/src/components/uoa/SignalDetailDrawer.jsx` — **new**

**Mockup**
- `frontend/mockups/uoa.html` — **new**, standalone HTML/Tailwind CDN mockup of the tape + drawer (built first, reviewed before any real code).

---

## Execution sequence

1. **Mockup first** — author `frontend/mockups/uoa.html` matching the ASCII spec above using inline Tailwind CDN and seed JSON. Iterate on look with user before any real code.
2. **Backend models + adapter** — add Pydantic models, extend Protocol, implement `flash_alpha.py` calls, add seed fixtures.
3. **Backend router + wire-up** — `routers/flow_signals.py`, mount in `main.py`. Smoke-test with `curl localhost:8000/api/flow/signals/SPX?min_score=60`.
4. **Frontend scaffolding** — route, sidebar entry, `api.js`, `useFlowSignals` hook with mocked response first.
5. **Frontend components** — top bar → summary strip → row → tape → breakdown bar → detail drawer, in that order.
6. **Polling + filters persistence** — 30s interval; persist filter state to localStorage.
7. **0DTE / expiry filter** — pass through to backend.
8. **Polish** — loading skeletons, empty state, error state (404 message style from `WatchlistMode`).

---

## Verification

- `./start.sh` from repo root; navigate to `/uoa`.
- With `GEX_ADAPTER=seed`: UOA view renders demo signals; filters work; detail drawer opens.
- With `GEX_ADAPTER=flash_alpha` and a valid `FLASH_ALPHA_API_KEY`:
  - `curl -s "localhost:8000/api/flow/signals/SPX?min_score=60&window_minutes=240" | jq` returns ≥1 signal with full `score_breakdown` and `enrichment`.
  - `curl -s "localhost:8000/api/flow/signals/SPX/summary" | jq` returns aggregates that match the strip numbers in the UI.
  - Sweep filter narrows results; bullish intent filter narrows results; minScore slider re-fetches.
  - 0DTE toggle resolves to today's ISO date (or next Monday on weekends — mirrors `get_next_monday` pattern already in `flash_alpha.py`).
- Browser: confirm tape auto-refreshes every 30s; refresh button forces immediate fetch; detail drawer closes cleanly; filter state survives reload.
- No console errors; no CORS errors (existing `CORS_ORIGINS` covers `localhost:5173`).

---

## Decisions (locked in)

- Sidebar label: **"Flow Signals"**. Route stays `/uoa` internally (short URL) but UI says Flow Signals.
- Scope: **single-symbol with switcher** (v1). Multi-symbol tape deferred.
- Detail drawer **deep-links strike into the GEX ladder** — clicking a strike in the drawer navigates to `/b3?symbol=SPX&strike=5850` (or `/expiry` if an expiry is set). Requires a small additive change to `B3Mode`/`ExpiryMode` to read those query params and scroll/highlight the matching strike (`InstrumentColumn` already auto-scrolls to spot — extend that to also accept a target strike).
