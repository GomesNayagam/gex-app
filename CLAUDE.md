# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Start both services (from repo root)
```bash
./start.sh
```

### Backend — always run from repo root
```bash
# From D:/Gomes/Dev/gex-app (NOT from inside backend/)
uv run uvicorn backend.main:app --reload --port 8000
```
The `backend/` folder is a Python package. Running from inside it causes `ModuleNotFoundError: No module named 'backend'`.

API docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
npm run build
```

### Python dependency management
```bash
uv add <package>   # add dependency (updates pyproject.toml + uv.lock)
uv sync            # install all deps
```

### Adapter selection
Controlled by `GEX_ADAPTER` env var in `backend/.env` (gitignored):
```
GEX_ADAPTER=flash_alpha
FLASH_ALPHA_API_KEY=<key>
```
Default is `seed` (hardcoded SPX/SPY/QQQ data). Set to `flash_alpha` for live data.

## Known API Shape Differences (Flash Alpha)

The two Flash Alpha endpoints return **different field names** for the same data:

| Field         | `/flow/gex/{symbol}`  | `/exposure/gex/{symbol}?expiration=` |
|---------------|-----------------------|---------------------------------------|
| Gamma flip    | `live_gamma_flip`     | `gamma_flip`                          |
| Net GEX       | `live_net_gex`        | `net_gex`                             |
| GEX label     | `live_net_gex_label`  | `net_gex_label`                       |
| Spot price    | `underlying_price`    | `underlying_price`                    |
| Strikes array | `strikes`             | `strikes`                             |

The adapter (`backend/adapters/flash_alpha.py`) handles both with `.get()` fallbacks:
```python
flip = data.get("live_gamma_flip") or data["gamma_flip"]
```
**Never assume `/exposure` returns the same keys as `/flow`.** Always check both field names when adding new fields from Flash Alpha responses.

## Architecture

### Backend (`backend/`)

Layered FastAPI app. **Always launched from repo root** as `backend.main:app`.

```
backend/
├── main.py           # App factory, CORS, lifespan (snapshot background task), router mounts
├── models.py         # Pydantic models: Strike, KeyLevel, InstrumentGEX, GEXResponse,
│                     #   GEXSnapshot, IntradaySeries
├── config.py         # pydantic-settings: reads backend/.env + .env
│                     #   GEX_ADAPTER, FLASH_ALPHA_BASE_URL, FLASH_ALPHA_API_KEY,
│                     #   CACHE_TTL_SECONDS (30), SNAPSHOT_INTERVAL_SECONDS (60),
│                     #   CORS_ORIGINS
├── adapters/
│   ├── base.py       # GEXDataAdapter Protocol: fetch(symbol) + available_symbols()
│   ├── seed.py       # SeedAdapter — hardcoded SPX/SPY/QQQ (21 strikes each)
│   └── flash_alpha.py # FlashAlphaAdapter — httpx async client, X-API-Key header
├── routers/
│   ├── gex.py        # GET /api/gex?strikes=50, GET /api/gex/{symbol}?strikes=N
│   ├── intraday.py   # GET /api/gex/{symbol}/intraday?lookback=6
│   └── system.py     # GET /health, GET /api/symbols
└── services/
    ├── snapshots.py  # In-memory deque (max 390) of GEXSnapshot per symbol
    └── cache.py      # TTL cache (30s default) keyed by symbol
```

**Flash Alpha integration:**
- Endpoint: `GET https://lab.flashalpha.com/v1/flow/gex/{symbol}`
- Auth: `X-API-Key` header (not Bearer)
- Returns 736 strikes for SPX — `/api/gex` defaults to `?strikes=50` around spot
- `call_wall` / `put_wall` computed from strike data (not a separate API call)
- `is_spot` / `is_flip` flags set in O(n) before the loop (pre-compute closest strike)

**Snapshot background task:** `main.py` lifespan starts `_snapshot_loop` which polls the adapter every 60s and appends to `services/snapshots.py` ring buffer. Powers the intraday chart.

**Adding a new symbol with flash_alpha adapter:** any valid ticker works — no code changes needed.
**Adding a new symbol with seed adapter:** add a factory in `backend/adapters/seed.py` and register it in `_FACTORIES`.

### Frontend (`frontend/src/`)

React 18 + Vite + **Tailwind CSS v3** + custom shadcn-style primitives. Single page, no router.

```
src/
├── App.jsx                     # Layout, header, responsive grid, intraday section
├── api.js                      # fetchAllGEX(), fetchGEXBySymbol(), fetchIntraday(), fetchHealth()
├── lib/
│   ├── utils.js                # cn() — clsx + tailwind-merge helper (required by ui/ components)
│   └── format.js               # fmtGex, fmtSpot, fmtStrike, fmtOI, toB
├── hooks/
│   ├── useGEXData.js           # 30s auto-refresh, manual refresh, loading/error state
│   └── useIntraday.js          # Fetches /intraday, re-polls every 60s
└── components/
    ├── ui/                     # Primitive components (no external shadcn dependency):
    │   ├── card.jsx            #   Card, CardHeader, CardTitle, CardContent
    │   ├── badge.jsx           #   Badge — variants: default, positive, negative, amber, muted
    │   ├── button.jsx          #   Button — variants: default, ghost, destructive
    │   ├── skeleton.jsx        #   Skeleton (animate-pulse)
    │   └── tabs.jsx            #   Tabs, TabsList, TabsTrigger, TabsContent (context-based)
    ├── InstrumentColumn.jsx    # Full GEX ladder: stat cards + strike table for one symbol
    ├── StatCard.jsx            # Call Wall / Flip / Put Wall / Pin cards with accent colors
    ├── StrikeRow.jsx           # Single strike: net bar (solid) + ghost call/put overlays
    ├── LoadingSkeleton.jsx     # Shimmer skeleton matching grid layout
    ├── IntradayChart.jsx       # Recharts LineChart — net GEX + gamma flip over session
    └── GEXProfileChart.jsx     # Recharts BarChart — call vs put GEX per strike (not yet wired in App)
```

**Responsive breakpoints (Tailwind):**
- `< sm` (mobile): tabbed symbol selector, single column
- `sm`–`lg` (tablet): 2-column grid
- `lg+` (desktop): 3-column grid

**Path alias:** `@/` → `src/` (configured in `vite.config.js` via `path.resolve`).

**Tailwind config:** color tokens in `tailwind.config.js` mirror existing CSS vars. The `index.css` declares both `@tailwind` directives and the legacy CSS custom properties (`--bg`, `--green`, `--red`, etc.) so both Tailwind classes and inline-style fallbacks work during migration.

**Custom API base:** set `VITE_API_BASE` in `frontend/.env.local`.

**CORS:** configured via `CORS_ORIGINS` env var; defaults cover `localhost:3000` and `localhost:5173`.

## Key Decisions

- **`backend/.env` is gitignored** — contains `GEX_ADAPTER` and `FLASH_ALPHA_API_KEY`. Never commit it.
- **50 strikes default** on `/api/gex` — Flash Alpha returns 700+ strikes for SPX; the UI filters to ±25 around spot. Override with `?strikes=N` (max 200).
- **Auth header is `X-API-Key`** — Flash Alpha does not use Bearer tokens.
- **No database** — snapshots are in-memory only; they reset on server restart.
- **`GEXProfileChart` exists** but is not yet rendered in `App.jsx` — wire it in when adding a detail/modal view per symbol.
