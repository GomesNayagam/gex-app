# GEX Dashboard

A self-hosted **Gamma Exposure (GEX) ladder dashboard** for options traders. Visualises net GEX, call/put walls, gamma flip, and intraday exposure across multiple symbols in real time.

Built with **FastAPI** (Python) + **React + Vite + Tailwind CSS**.

---

<img width="1000" height="900" alt="image" src="https://github.com/user-attachments/assets/6cedb173-8c2d-4d61-abc1-6f55eec5df4a" />
<img width="1000" height="900" alt="Screenshot_2" src="https://github.com/user-attachments/assets/904ceb4b-4bd4-471a-a933-8995088431be" />




## Features

- **GEX Ladder** — strike-by-strike net GEX bars with call/put overlays
- **Key Level Tags** — Call Wall, γ Flip, Put Wall, Pin annotated inline on their strike rows
- **Intraday Chart** — net GEX + gamma flip line plotted over the session (60 s polling)
- **Multi-view SPA** — B3 (3-instrument split pane), Watchlist, Expiry, Settings
- **Auto-scroll to spot** — ladder centres on the current spot price on every load
- **30 s auto-refresh** with visual countdown; manual refresh button
- **Responsive** — mobile single-column, tablet 2-up, desktop 3-up
- **Adapter pattern** — swap in any data source (seed demo data included, Flash Alpha adapter built-in)

---

## Quick Start

### Prerequisites

- Python ≥ 3.11 with [`uv`](https://github.com/astral-sh/uv) installed
- Node.js ≥ 18

### 1. Clone & configure

```bash
git clone https://github.com/your-username/gex-app.git
cd gex-app
cp backend/.env.example backend/.env
# Edit backend/.env — set GEX_ADAPTER and (optionally) FLASH_ALPHA_API_KEY
```

### 2. Start both services

```bash
./start.sh
```

This starts the FastAPI backend on **http://localhost:8000** and the Vite dev server on **http://localhost:5173**.

### Manual start

**Backend:**

```bash
cd backend
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

---

## Adapters

The adapter is controlled by `GEX_ADAPTER` in `backend/.env`:

| Value | Description |
|---|---|
| `seed` | Demo data — hardcoded SPX, SPY, QQQ strikes. No API key needed. |
| `flash_alpha` | Live data via [Flash Alpha](https://flashalpha.com). Requires `FLASH_ALPHA_API_KEY`. |

To add a new adapter, implement the `GEXDataAdapter` protocol in `backend/adapters/base.py` and register it in `backend/main.py`.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/api/symbols` | Available symbols |
| GET | `/api/gex` | All instruments (default 50 strikes around spot) |
| GET | `/api/gex/{symbol}` | Single instrument |
| GET | `/api/gex/{symbol}?strikes=N` | Filtered to N strikes around spot (max 200) |
| GET | `/api/gex/{symbol}/intraday` | Intraday snapshot series |
| GET | `/api/gex/{symbol}?expiration=YYYY-MM-DD` | Single expiry GEX |

```bash
# Health check
curl http://localhost:8000/health

# SPX with 20 strikes around spot
curl http://localhost:8000/api/gex/SPX?strikes=20

# Interactive API docs
open http://localhost:8000/docs
```

---

## GEX Calculation Reference

```
GEX per strike = Γ × OI × contract_multiplier × spot²
Net GEX        = Σ call_GEX − Σ put_GEX   (all expirations, per strike)
Gamma Flip     = strike where cumulative net GEX crosses zero
Call Wall      = strike with max call GEX above spot  (resistance)
Put Wall       = strike with max |put GEX| below spot (support)
Pin Strike     = strike with max |net GEX| near spot  (intraday magnet)
```

---

## Architecture

### Backend (`backend/`)

```
backend/
├── main.py           # App factory, CORS, lifespan, router mounts
├── models.py         # Pydantic models: Strike, KeyLevel, InstrumentGEX, GEXSnapshot
├── config.py         # pydantic-settings — reads backend/.env
├── adapters/
│   ├── base.py       # GEXDataAdapter Protocol
│   ├── seed.py       # Demo data adapter
│   └── flash_alpha.py# Flash Alpha live adapter
├── routers/
│   ├── gex.py        # GEX ladder endpoints
│   ├── intraday.py   # Intraday time-series endpoint
│   ├── dealer_risk.py# Dealer risk exposure endpoint
│   └── system.py     # /health, /api/symbols
└── services/
    ├── cache.py      # TTL cache (30 s default)
    └── snapshots.py  # In-memory ring buffer (max 390 snapshots per symbol)
```

### Frontend (`frontend/src/`)

```
src/
├── App.jsx                 # Root layout
├── api.js                  # Fetch wrappers for all backend endpoints
├── lib/
│   ├── format.js           # Number formatters (fmtGex, fmtSpot, toB, …)
│   └── utils.js            # cn() — clsx + tailwind-merge
├── hooks/
│   ├── useGEXData.js       # 30 s auto-refresh hook
│   ├── useIntraday.js      # 60 s intraday polling hook
│   ├── useWatchlist.js     # localStorage-backed watchlist
│   └── useSidebar.js       # Sidebar open/close state
├── components/
│   ├── shell/              # AppShell, Sidebar, TopBar, MarketClock
│   ├── ui/                 # Primitive components (Card, Badge, Button, Tabs, Skeleton)
│   ├── InstrumentColumn.jsx# GEX ladder for one symbol
│   ├── StrikeRow.jsx       # Single strike row with bars + key-level tags
│   ├── IntradayChart.jsx   # Recharts net GEX line chart
│   └── GEXProfileChart.jsx # Recharts call/put bar chart (available, not yet in default view)
└── views/
    ├── B3Mode.jsx          # 3-symbol split-pane view
    ├── WatchlistMode.jsx   # Custom ticker list view
    ├── ExpiryMode.jsx      # Single-expiry deep-dive view
    └── Settings.jsx        # App settings
```

---

## Environment Variables

**Backend** (`backend/.env`, gitignored — copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `GEX_ADAPTER` | `seed` | `seed` or `flash_alpha` |
| `FLASH_ALPHA_API_KEY` | — | Required when using flash_alpha adapter |
| `CACHE_TTL_SECONDS` | `30` | How long adapter responses are cached |
| `SNAPSHOT_INTERVAL_SECONDS` | `60` | How often intraday snapshots are recorded |
| `CORS_ORIGINS` | `[...]` | JSON array of allowed origins |

**Frontend** (`frontend/.env.local`, gitignored):

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000` | Backend base URL |

---

## License

This project is licensed under the **Personal Use License**. Free for personal, non-commercial use. Commercial use requires the author's written consent. See [LICENSE](LICENSE) for full terms.

---

## Contributing

Contributions are welcome! By submitting a pull request you agree that your contribution is licensed under the same [Personal Use License](LICENSE) as this project.

### Workflow

1. **Fork** the repository and create a feature branch from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Set up** your local environment (see Quick Start above).

3. **Make changes** — keep commits focused and atomic. Follow the existing code style.

4. **Test** your changes end-to-end:
   - Backend: start the server and hit the relevant endpoints with `curl` or the `/docs` UI
   - Frontend: run the dev server and verify the feature visually in a browser
   - Check for regressions in other views (B3, Watchlist, Expiry)

5. **Open a pull request** against `master`:
   - Describe **what** changed and **why**
   - Include before/after screenshots for UI changes
   - Reference any related issues

### Guidelines

- **One concern per PR** — avoid mixing unrelated changes
- **No secrets** — never commit API keys, `.env` files, or personal credentials
- **Backend** — use `uv` for dependency management; update `pyproject.toml`, not `requirements.txt`
- **Frontend** — no new external UI libraries; extend the existing `ui/` primitives
- **Mobile first** — all UI changes must be tested at mobile viewport widths
- **Adapter additions** — new data source adapters are especially welcome; implement `GEXDataAdapter` in `backend/adapters/` and add a section to this README

### Reporting Issues

Open a GitHub Issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Backend and frontend logs (redact any API keys)
- Browser and OS version for frontend issues
