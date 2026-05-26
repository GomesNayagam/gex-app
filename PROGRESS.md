# Progress

## Nav Redesign (`feature/nav-redesign` → merged to `master`)

### Completed

- **Shell & routing** — AppShell, Sidebar, TopBar, MarketClock; React Router with `/b3`, `/watch`, `/expiry`, `/settings` views
- **B3Mode** — split-pane layout with compact instrument columns
- **WatchlistMode** — 0DTE toggle, ticker management
- **ExpiryMode** — symbol/date form, GEX ladder panels, pinning; panels persisted to `localStorage` so they survive navigation
- **StatCard removal** — removed the 4-chip stat card grid above the ladder; key levels (Call Wall, γ Flip, Put Wall, Pin) are now annotated as inline colored tags directly on their strike rows in the ladder
- **Strike row layout** — strike + tags share a single flex row (strike left, tags inline after); bar column uses `minmax(80px,auto)_1fr_48px` grid so bars stay centered regardless of tag presence
- **Auto-scroll to spot** — InstrumentColumn scrolls the ladder to center the spot price line on every data load via `scrollIntoView({ block: "center" })`

### Design Decisions

- Tags use per-type accent color with tinted bg + border (e.g. green for Call Wall, blue for γ Flip)
- Strike and tags must share one flex column — separate grid columns caused misalignment when tags were absent on most rows
- Net GEX bar alignment requires a fixed-width column; solved by merging strike+tags into `minmax(80px,auto)` so the bar column always starts at the same offset

---

## Flow Signals / UOA (`feature/signals` → in progress)

### Completed

- **Backend models** — `ScoreBreakdown`, `SignalEnrichment`, `ChainContext`, `FlowSignal`, `FlowSignalsResponse`, `FlowSignalsSummary` added to `backend/models.py`
- **Adapter protocol** — extended `GEXDataAdapter` in `backend/adapters/base.py` with `fetch_flow_signals` and `fetch_flow_signals_summary`
- **FlashAlphaAdapter** — proxies `/v1/flow/signals/{symbol}` and `/v1/flow/signals/{symbol}/summary`; defensive `.get()` fallbacks on all optional fields
- **SeedAdapter** — 3 hand-crafted demo signals (whale sweep, golden sweep, block close) with full score breakdowns and enrichment; filtering by `min_score`, `intent`, `structure` applied in-memory
- **Router** — `backend/routers/flow_signals.py` with `GET /api/flow/signals/{symbol}`, `GET /api/flow/signals/{symbol}/summary`, `GET /api/flow/signals/watchlist`; mounted in `main.py`
- **Frontend API** — `fetchFlowSignals`, `fetchFlowSummary`, `fetchFlowWatchlist` added to `api.js`
- **Format helpers** — `fmtPremium` and `fmtScore` added to `lib/format.js`
- **useFlowSignals hook** — 30s polling, filter state persisted to `localStorage` under `uoa-filters`, re-fetches on any filter change
- **UOATopBar** — symbol switcher (SPX/SPY/QQQ), window pill (60m/240m/1d), min-score slider, intent/structure toggles, 0DTE toggle, animated refresh arc
- **UOASummaryStrip** — spot, signal count, bull/bear premium ratio bar, net directional premium, opening/closing premium
- **SignalRow** — score chip (color-coded by tier), intent glyph, time, contract details, flow (structure + aggressor glyph + open/close bias), breakdown bar, tag badges
- **ScoreBreakdownBar** — 6-segment stacked bar (P/S/A/W/O/T) with hover tooltips per component
- **SignalTape** — scrollable list of `SignalRow`; empty-state message when no signals match
- **SignalDetailDrawer** — slide-over with score breakdown per-component bars, Greeks (IV/δ/γ/IV vs ATM/moneyness), notional (δ-notional, hypothetical GEX impact), chain context anchors, tags, deep-link to GEX ladder, raw JSON toggle; pin/dock mode persisted to `localStorage`
- **UOAMode view** — wires all components; handles loading/error states
- **Routing** — `/uoa` route registered in `App.jsx`; "Flow Signals" nav entry with `Flame` icon added to `Sidebar.jsx`

### Design Decisions

- Sidebar label is **"Flow Signals"**; route stays `/uoa` (short URL)
- Score chip color tiers: 90+ green, 80–89 blue, 60–79 amber, <60 muted
- Aggressor glyphs: `above_ask` ⇧⇧, `at_ask` ⇧, `mid` ◆, `at_bid` ⇩, `below_bid` ⇩⇩
- Drawer pin state survives reload via `localStorage` key `uoa-drawer-pinned`
- Flash Alpha `/flow/signals` endpoint returns empty signals outside market hours — seed adapter provides full demo data for dev/testing without an API key
