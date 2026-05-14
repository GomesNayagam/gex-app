# GEX App — Navigation Redesign & Feature Expansion Plan

## Context

The current `App.jsx` is a single-page, vertically-stacked layout: header → 3-column instrument grid → intraday chart at the bottom. This causes several UX problems:

- `IntradayChart` is below the fold; users must scroll past three full strike ladders to see it.
- Only SPX/SPY/QQQ are surfaced (hardcoded "Big Three"); no path for on-demand tickers (TSLA, NVDA, 0DTE plays).
- No way to focus on a single expiry — backend returns "all expirations" aggregate.
- On smaller desktops the 3-column grid forces horizontal cramping; medium widths push content off-screen.
- Visual language is functional but inconsistent with high-end institutional terminals (Bloomberg / TT / Tradytics).

Goal: convert the app into a true SPA shell with a persistent left navigation, four mode-specific workspaces, an above-the-fold chart in B3 mode, and a tightened institutional visual system.

## High-Level Architecture

Introduce a lightweight client-side router and an `AppShell` layout. No backend framework change; FastAPI endpoints get one new query param (`expiry`) and one new route is reused for arbitrary symbols.

```
<AppShell>
  ├─ <Sidebar />               persistent, collapsible to icons
  ├─ <TopBar />                status, refresh, timestamp, source
  └─ <Workspace>               routed view
       ├─ /b3        → <B3Mode />            (SPX, SPY, QQQ split view)
       ├─ /watch     → <WatchlistMode />     (on-demand tickers)
       ├─ /expiry    → <ExpiryMode />        (single symbol + expiry picker)
       └─ /settings  → <Settings />          (theme, refresh rate, api source)
```

Routing: add `react-router-dom` (smallest dependency that fits). Default route `/b3`.

## Feature Specs

### 1. AppShell + Left Sidebar Navigation
- New file: `frontend/src/components/shell/AppShell.jsx`
- New file: `frontend/src/components/shell/Sidebar.jsx`
- Sidebar items: **B3 Mode**, **Watchlist**, **Expiry View**, **Settings**. Icons from `lucide-react` (`LayoutGrid`, `Star`, `CalendarRange`, `Settings2`).
- Width: `w-56` expanded, `w-14` collapsed (toggle persisted to `localStorage`).
- Active route gets accent border + subtle blue tint (reuse `--border-soft` / `bg-blue/10`).
- Top status bar (refresh, timestamp, API status) moves out of page body and into `TopBar` component pinned at top of workspace.

### 2. B3 Mode — Split View (chart above the fold)
- New file: `frontend/src/views/B3Mode.jsx` (replaces inline logic in current `App.jsx`).
- Layout: `grid grid-cols-12 gap-4 h-[calc(100vh-headerH)]`.
  - Left pane (`col-span-7`): vertical stack of three **compact** `InstrumentColumn`s. Each ladder gets its own scroll container (`overflow-y-auto`) so the page itself does not scroll.
  - Right pane (`col-span-5`, sticky): `IntradayChart` for the currently-focused instrument + a 3-button symbol switcher above it. Below the chart: a compact `StatCard` row (Call Wall / Flip / Put Wall / Pin) for the active symbol.
- Active symbol selection lifted to `B3Mode` state; clicking any ladder row or the symbol pill updates the right pane.
- Result: chart is **always visible** at typical 1080p+ resolutions; ladders scroll independently.
- Modify `InstrumentColumn.jsx` to accept a `compact` prop (smaller header, denser strikes) for B3 use.

### 3. Watchlist Mode (on-demand tickers: TSLA, NVDA, 0DTE)
- New file: `frontend/src/views/WatchlistMode.jsx`
- New file: `frontend/src/hooks/useWatchlist.js` — manages `localStorage` (`gex.watchlist` key), seeded with `["TSLA","NVDA"]`.
- UI: add-ticker input (uppercase, validated) + chip row of current watchlist with × remove. Selecting a chip shows detail panel: `StatCard` row + `IntradayChart` + `InstrumentColumn` (single symbol, full strikes).
- Backend: existing `GET /api/gex/{symbol}` already supports arbitrary symbols when `GEX_ADAPTER=flash_alpha`. No backend changes needed for live mode. In `seed` mode, show a "Live data required" empty state.
- 0DTE toggle: a small switch on this view. **0DTE continues to use the existing `/flow/gex/{symbol}` Flash Alpha endpoint** (the same one the B3 mode uses) — no `expiration` param is sent. Backend treats `expiry=0dte` as a hint to keep using the flow endpoint (server-side filter optional) rather than swapping to the exposure endpoint.

### 4. Expiry Mode (specific-expiry input screen)
- New file: `frontend/src/views/ExpiryMode.jsx`
- UI: symbol input + expiry date picker (HTML `<input type="date">` styled to match). Submit → fetch & render single-expiry GEX ladder + dedicated chart.
- **Backend change** (`backend/routers/gex.py`): add optional `expiry: str | None` query param (ISO date `YYYY-MM-DD`, or the literal `0dte`) to `GET /api/gex/{symbol}`. Threaded through `GEXDataAdapter.fetch(symbol, expiry=None)`.
- **Flash Alpha endpoint routing inside `FlashAlphaAdapter.fetch`** (`backend/adapters/flash_alpha.py`):
  - `expiry is None` → `GET /flow/gex/{symbol}` (current behaviour, B3 mode).
  - `expiry == "0dte"` → `GET /flow/gex/{symbol}` (same flow endpoint — Flash Alpha's flow API already represents today's positioning; do **not** send `expiration`).
  - `expiry` is an ISO date → `GET /exposure/gex/{symbol}?expiration=YYYY-MM-DD` (e.g. `https://lab.flashalpha.com/v1/exposure/gex/TSLA?expiration=2026-05-15`). Parse the exposure response into the same `InstrumentGEX` shape; the existing strike→`Strike` mapping in `flash_alpha.py:33-47` should be reused, with a small response-shape adapter if the `/exposure` payload differs (verify field names: `strikes`, `underlying_price`, `live_gamma_flip`, `live_net_gex`, `live_net_gex_label`; fall back to equivalents from `/exposure` schema where needed).
  - Validate `expiry` format at the router boundary (regex `^\d{4}-\d{2}-\d{2}$|^0dte$`) and return 422 on invalid input.
- `SeedAdapter`: accept and ignore `expiry` — document via empty/notice state on the Expiry view when `GEX_ADAPTER=seed`.
- Add `GET /api/expirations/{symbol}` returning a list of known expiry dates. Implementation: call `/exposure/gex/{symbol}` once without `expiration` (or a dedicated Flash Alpha listing endpoint if available) and extract distinct expiries; cache per-symbol via the existing TTL cache in `backend/services/cache.py`. Used to populate the date-picker datalist on `/expiry`.

### 5. Removing Horizontal Scroll / Institutional SPA Feel
- Replace fixed `grid-cols-3` body width with fluid `min-w-0` containers in every column; every table/ladder gets `overflow-x-hidden` and ellipsizes long labels.
- All workspaces sized to `h-[calc(100vh-Npx)]` with **internal** scroll only — no page-level horizontal scroll.
- Strike ladder: tighten typography (`text-[10px]`, tabular-nums), constant 28px row height, right-align numeric columns.

### 6. Visual System Upgrade (institutional polish)
- Tighten the design tokens in `tailwind.config.js` and `index.css`:
  - Two surfaces only: `--bg` (deepest) and `--surface-1` (cards). Drop incidental greys.
  - Borders: single `--border` (10% white) + `--border-soft` (5%). Remove duplicated tones.
  - Type scale: 9 / 10 / 11 / 13 / 15 only. Headings switch to a `tracking-tight` weight-500 sans (system stack); numerics use `font-mono` + `tabular-nums` everywhere.
  - Accent palette restricted to: green / red / amber / blue / text-1/2/3. No additional hues.
- Sidebar + TopBar use `--surface-1` with a 1px right/bottom border, no shadow.
- StatCards: remove gradients; use a 2px left accent bar (color-coded), flat fill, mono numerics. Hover lifts via `border` change only.
- Add a session-aware market clock in TopBar (NY time + "REG / PRE / POST / CLOSED" pill).
- Subtle entrance: rows fade-in once (`animate-in fade-in duration-200`), no perpetual animations except the refresh progress bar and the status dot pulse.

## Files to Add / Modify

### Add
- `frontend/src/components/shell/AppShell.jsx`
- `frontend/src/components/shell/Sidebar.jsx`
- `frontend/src/components/shell/TopBar.jsx`
- `frontend/src/components/shell/MarketClock.jsx`
- `frontend/src/views/B3Mode.jsx`
- `frontend/src/views/WatchlistMode.jsx`
- `frontend/src/views/ExpiryMode.jsx`
- `frontend/src/views/Settings.jsx`
- `frontend/src/hooks/useWatchlist.js`
- `frontend/src/hooks/useSidebar.js`

### Modify
- `frontend/src/App.jsx` — reduce to `<BrowserRouter><AppShell><Routes/></AppShell></BrowserRouter>`.
- `frontend/src/components/InstrumentColumn.jsx` — add `compact` prop; allow independent scroll.
- `frontend/src/components/IntradayChart.jsx` — accept `height` prop; remove fixed bottom margin.
- `frontend/src/api.js` — add `fetchGEXBySymbol(symbol, { strikes, expiry })` overload; add `fetchExpirations(symbol)`.
- `frontend/src/hooks/useGEXData.js` — generalize to take a symbol list (B3 default = SPX/SPY/QQQ; Watchlist passes its own).
- `frontend/package.json` — add `react-router-dom`.
- `tailwind.config.js`, `frontend/src/index.css` — tightened tokens.
- `backend/routers/gex.py` — add `expiry` query param.
- `backend/adapters/base.py` — extend `fetch` signature to `fetch(symbol: str, expiry: str | None = None)`.
- `backend/adapters/flash_alpha.py` — pass `expiration` to upstream.
- `backend/adapters/seed.py` — accept and ignore `expiry`.
- `backend/routers/system.py` — add `GET /api/expirations/{symbol}`.

## Implementation Order
1. Backend: add `expiry` param + `/api/expirations/{symbol}` (smallest, unblocks frontend).
2. Frontend: install router, scaffold `AppShell` + `Sidebar` + `TopBar`, move existing UI under `/b3` unchanged.
3. Rebuild `/b3` as split view; introduce `compact` `InstrumentColumn`.
4. Build `/watch` with `useWatchlist` and single-symbol detail panel.
5. Build `/expiry` view + expirations datalist.
6. Visual system pass: tokens, MarketClock, StatCard restyle, type scale.
7. QA pass: verify no horizontal scroll at 1280/1440/1920; chart above fold in `/b3`; watchlist persists across reload; expiry param hits backend with correct value.

## Verification
- `./start.sh`, open `http://localhost:3000`.
- `/b3`: at 1440×900, IntradayChart fully visible without scrolling. Switch active symbol via right-pane pills; chart updates.
- `/watch`: add `AAPL`, remove `TSLA`, reload — watchlist persists. Toggle 0DTE → network tab shows `?expiry=0dte`.
- `/expiry`: pick a date → network tab shows `?expiry=YYYY-MM-DD`; ladder renders single-expiry strikes.
- `curl 'http://localhost:8000/api/gex/TSLA?expiry=2026-05-15&strikes=50'` returns 200; backend logs show upstream call to `https://lab.flashalpha.com/v1/exposure/gex/TSLA?expiration=2026-05-15`.
- `curl 'http://localhost:8000/api/gex/TSLA?expiry=0dte'` returns 200; backend logs show upstream call to `/flow/gex/TSLA` (no `expiration` param sent).
- `curl 'http://localhost:8000/api/gex/SPX'` (no `expiry`) still hits `/flow/gex/SPX` — B3 mode unchanged.
- `curl 'http://localhost:8000/api/gex/SPX?expiry=foo'` returns 422.
- `curl http://localhost:8000/api/expirations/SPX` returns a non-empty list.
- Resize browser 1280 → 1920: no horizontal scrollbar at any width; only internal panes scroll.
- Lighthouse / DevTools: no console errors; route changes do not refetch unchanged data within cache TTL.
