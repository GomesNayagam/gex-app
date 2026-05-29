# CLAUDE.md

GEX Dashboard — Gamma Exposure ladder dashboard for options traders.

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v3 + React Router
- **Backend:** Python + FastAPI + pydantic-settings
- **Persistence:** LocalStorage (watchlist, pinned panels); in-memory ring buffer (intraday snapshots)

## Rules

- Python backend **must use `uv`** package tool with virtual environment (`uv sync`, `uv run`)
- Always launch the backend **from the repo root** as `backend.main:app` (not from inside `backend/`)
- Never commit `backend/.env` or `frontend/.env.local` — they are gitignored

## Commands

### Start both services (from repo root)

```bash
./start.sh
```

### Backend only

```bash
uv run uvicorn backend.main:app --reload --port 8000
```

### Frontend only

```bash
cd frontend && npm run dev
```

## Planning

- Save all plans to `.claude/plans/`
- Naming convention: `{sequence}-{plan-name}.md` (e.g., `1-auth-setup.md`)
- Plan should be detailed enough to execute without ambiguity

## Development Flow

1. **Plan and Spec** — user superpowers to create a plan and spec.
2. **Build** — Execute the plan
3. **Validate** — Test end-to-end. Use browser MCP for UI validation where possible
4. **Iterate** — Fix issues found during validation

## Architecture

### Backend (`backend/`)

Layered FastAPI app. Always launched from repo root as `backend.main:app`.

```
backend/
├── main.py           # App factory, CORS, lifespan (_snapshot_loop background task), router mounts
├── models.py         # Pydantic models: Strike, KeyLevel, InstrumentGEX, GEXResponse,
│                     #   GEXSnapshot, IntradaySeries
├── config.py         # pydantic-settings: reads backend/.env
│                     #   GEX_ADAPTER, FLASH_ALPHA_BASE_URL, FLASH_ALPHA_API_KEY,
│                     #   CACHE_TTL_SECONDS (30s), SNAPSHOT_INTERVAL_SECONDS (60s), CORS_ORIGINS
├── adapters/
│   ├── base.py       # GEXDataAdapter Protocol: fetch(symbol, expiration?) + available_symbols()
│   ├── seed.py       # SeedAdapter — hardcoded SPX/SPY/QQQ (21 strikes each)
│   └── flash_alpha.py# FlashAlphaAdapter — httpx async client, X-API-Key header
├── routers/
│   ├── gex.py        # GET /api/gex?strikes=50, GET /api/gex/{symbol}?strikes=N&expiration=
│   ├── intraday.py   # GET /api/gex/{symbol}/intraday?lookback=6
│   ├── dealer_risk.py# GET /api/gex/{symbol}/dealer-risk
│   └── system.py     # GET /health, GET /api/symbols
└── services/
    ├── snapshots.py  # In-memory deque (max 390) of GEXSnapshot per symbol
    └── cache.py      # TTL cache keyed by (symbol, expiration)
```

### Frontend (`frontend/src/`)

React 18 + Vite + Tailwind CSS v3. SPA with React Router. No external UI library — shadcn-style primitives are hand-rolled in `components/ui/`.

```
src/
├── App.jsx                     # Root: React Router, AppShell wiring
├── api.js                      # fetchAllGEX(), fetchGEXBySymbol(), fetchIntraday(), fetchHealth()
├── lib/
│   ├── format.js               # fmtGex, fmtSpot, fmtStrike, fmtOI, toB
│   └── utils.js                # cn() — clsx + tailwind-merge (required by ui/ components)
├── hooks/
│   ├── useGEXData.js           # 30 s auto-refresh, manual refresh, loading/error state
│   ├── useIntraday.js          # 60 s polling for /intraday endpoint
│   ├── useWatchlist.js         # localStorage-backed custom ticker list
│   └── useSidebar.js           # Sidebar open/close state
├── components/
│   ├── shell/
│   │   ├── AppShell.jsx        # Main layout: Sidebar + TopBar + outlet
│   │   ├── Sidebar.jsx         # Nav links for B3/Watchlist/Expiry/Settings
│   │   ├── TopBar.jsx          # Header bar with refresh controls
│   │   └── MarketClock.jsx     # Live ET clock with market-open indicator
│   ├── ui/                     # Primitive components (no external shadcn dependency):
│   │   ├── card.jsx            #   Card, CardHeader, CardTitle, CardContent
│   │   ├── badge.jsx           #   Badge — variants: default, positive, negative, amber, muted
│   │   ├── button.jsx          #   Button — variants: default, ghost, destructive
│   │   ├── skeleton.jsx        #   Skeleton (animate-pulse)
│   │   └── tabs.jsx            #   Tabs, TabsList, TabsTrigger, TabsContent (context-based)
│   ├── InstrumentColumn.jsx    # Full GEX ladder: key-level tags + strike rows; auto-scrolls to spot
│   ├── StrikeRow.jsx           # Single strike: net bar (solid) + ghost call/put overlays + inline tags
│   ├── LoadingSkeleton.jsx     # Shimmer skeleton matching grid layout
│   ├── IntradayChart.jsx       # Recharts LineChart — net GEX + gamma flip over session
│   └── GEXProfileChart.jsx     # Recharts BarChart — call vs put GEX per strike
└── views/
    ├── B3Mode.jsx              # 3-symbol split-pane layout (default view at /)
    ├── WatchlistMode.jsx       # Custom ticker list with 0DTE toggle
    ├── ExpiryMode.jsx          # Single-expiry deep-dive; panels pinned to localStorage
    └── Settings.jsx            # App-level settings UI
```

**Routing:** React Router v6. Routes: `/` → B3Mode, `/watch` → WatchlistMode, `/expiry` → ExpiryMode, `/settings` → Settings.

**Path alias:** `@/` → `src/` (configured in `vite.config.js`).

**Responsive breakpoints:**

- `< sm` (mobile): single column
- `sm`–`lg` (tablet): 2-column grid
- `lg+` (desktop): 3-column grid

## Adapter Configuration

Controlled by `GEX_ADAPTER` env var in `backend/.env` (gitignored). Copy `backend/.env.example` to get started.

```
GEX_ADAPTER=flash_alpha
FLASH_ALPHA_API_KEY=<your_key>
```

Default is `seed` (hardcoded demo data, no API key needed).

## Flash Alpha API — Known Field Name Differences

The two Flash Alpha endpoints return **different field names** for the same data:

| Field         | `/flow/gex/{symbol}` | `/exposure/gex/{symbol}?expiration=` |
| ------------- | -------------------- | ------------------------------------ |
| Gamma flip    | `live_gamma_flip`    | `gamma_flip`                         |
| Net GEX       | `live_net_gex`       | `net_gex`                            |
| GEX label     | `live_net_gex_label` | `net_gex_label`                      |
| Spot price    | `underlying_price`   | `underlying_price`                   |
| Strikes array | `strikes`            | `strikes`                            |

The adapter (`backend/adapters/flash_alpha.py`) handles both with `.get()` fallbacks:

```python
flip = data.get("live_gamma_flip") or data["gamma_flip"]
```

**Never assume `/exposure` returns the same keys as `/flow`.** Always check both field names when adding new fields.

## Key Decisions

- **`backend/.env` is gitignored** — contains `GEX_ADAPTER` and `FLASH_ALPHA_API_KEY`. Never commit it.
- **50 strikes default** on `/api/gex` — Flash Alpha returns 700+ strikes for SPX; the backend filters to ±25 around spot. Override with `?strikes=N` (max 200).
- **Auth header is `X-API-Key`** — Flash Alpha does not use Bearer tokens.
- **No database** — snapshots are in-memory only; they reset on server restart.
- **Key levels are inline tags** — Call Wall, γ Flip, Put Wall, Pin are shown as coloured tags directly on their strike row in the ladder (no separate stat card grid).
- **`GEXProfileChart` exists** but is not yet rendered by default — wire it in when building a symbol detail/modal view.
- **Adding a new symbol (flash_alpha adapter):** any valid ticker works — no code changes needed.
- **Adding a new symbol (seed adapter):** add a factory in `backend/adapters/seed.py` and register it in `_FACTORIES`.
