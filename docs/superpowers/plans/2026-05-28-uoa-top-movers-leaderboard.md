# UOA Top Movers Leaderboard

## Context

Traders using UOAMode need to quickly spot which symbols are seeing the biggest
*directional* options money flow in the last 60 minutes, beyond the symbols
they've manually added to the watchlist. The Flash Alpha endpoint
`/v1/flow/options/leaderboard?n=10&windowMinutes=60` returns ranked
**buyers** (net positive notional) and **sellers** (net negative notional).

Goal: a compact, always-visible leaderboard strip in UOAMode that surfaces
top movers, makes it one click to add an interesting symbol to the watchlist
and activate it, and updates on the same cadence as the rest of the signals.

User selections in clarification:
- Placement: full-width strip above the signal tape
- Click action: add to watchlist + activate as current symbol
- Row fields: symbol + netNotional (primary) · buy/sell split bar · last-trade relative time

## Wireframe

Full-width strip sits between `UOASummaryStrip` and `SignalTape`. Two-column
layout (BUYERS left, SELLERS right). Each side: 5 rows visible, scroll for the
rest (n=10). Color: green for buyers, red for sellers, matching `--color-bull`
/ `--color-bear` tokens already in the sketch theme.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TOP MOVERS · 60m                                          updated 12:04:08 ET ⟳  │
├──────────────────────────────── BUYERS ▲ ──────┬──────────── SELLERS ▼ ──────────┤
│ # SYM    NET $       BUY/SELL VOL       LAST   │ # SYM   NET $      B/S VOL  LAST│
│ 1 AMD    +$19.8M ███████ [62%▌38%]      3s ago │ 1 SPY  −$14.0M  [46%▌54%]    1s  │
│ 2 MU     +$13.1M █████   [54%▌46%]      5s ago │ 2 SPX  −$12.6M  [48%▌52%]   12s  │
│ 3 NVDA   +$ 9.2M ███     [58%▌42%]     11s ago │ 3 TSLA −$ 6.4M  [44%▌56%]    7s  │
│ 4 AAPL   +$ 4.1M █▌      [55%▌45%]     22s ago │ 4 META −$ 3.2M  [47%▌53%]   18s  │
│ 5 ...                                          │ 5 ...                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Row anatomy (single row, both columns share):
- **Rank** `1` — dim numeral, fixed width
- **Symbol** `AMD` — bold, click target. Hover shows "add to watchlist & activate"
- **Net $** `+$19.8M` — formatted via existing `lib/format.js` (toB-style),
  green for buyers, red for sellers
- **Magnitude bar** — horizontal bar; width relative to top row in that column
  (top row = 100%), filled with intent color
- **B/S split** — small inline bar segmented buyVolume vs sellVolume,
  percentages as tooltip; renders as `[62%▌38%]` mini-bar styled like the
  `prem-bar` in `summary-strip`
- **Last** — relative time (`3s ago`, `2m ago`), greys out after 5 min

Already-in-watchlist symbols get a subtle pin/dot indicator on the left; clicking
just activates them (no duplicate add).

Header strip shows:
- Title `TOP MOVERS · 60m`
- Window pill group? **No** — keep static 60m for v1; future enhancement
- `updated HH:MM:SS ET` + manual refresh icon (same icon as `UOATopBar`)

Empty state: "No flow data in window" centered, muted text.

## Backend changes

`backend/`

1. **`adapters/base.py`** — extend `GEXDataAdapter` Protocol with
   `async fetch_leaderboard(window_minutes: int, n: int) -> LeaderboardResponse`.
2. **`adapters/flash_alpha.py`** — implement using existing `httpx` client and
   `X-API-Key` header pattern (mirror how `fetch_flow_signals` is structured in
   the same file).
3. **`adapters/seed.py`** — return a static stub so dev mode without a key
   still renders something realistic.
4. **`models.py`** — add Pydantic models:
   - `LeaderboardEntry` (symbol, netVolume, netNotional, buyVolume, sellVolume,
     avgPremium, tradeCount, lastTradeUtc)
   - `LeaderboardResponse` (generatedUtc, n, windowMinutes, buyers, sellers)

   Use `Field(alias=...)` so the camelCase upstream keys map cleanly; keep
   snake_case in Python.
5. **`routers/flow_signals.py`** — add `GET /api/flow/leaderboard?window=60&n=10`.
   Cache via existing `services/cache.py` TTL pattern keyed by
   `("leaderboard", window, n)`. TTL = 30s (same as other flow endpoints).

## Frontend changes

`frontend/src/`

1. **`api.js`** — add `fetchLeaderboard({ window = 60, n = 10 })`.
2. **`hooks/useLeaderboard.js`** — new hook. Poll on the same interval as
   `useFlowSignals` (re-use `REFRESH_INTERVAL` constant). Returns
   `{ data, loading, error, elapsed, refresh }`. Pattern-match
   `hooks/useFlowSignals.js` closely.
   Filter out `SPX`, `SPY`, `QQQ` from both `buyers` and `sellers` before
   rendering (these are the dashboard's own index symbols and would dominate
   every window). Keep the constant in one place — e.g.
   `const LEADERBOARD_EXCLUDE = new Set(["SPX", "SPY", "QQQ"])` in the hook.
   Show top 10 after exclusion (request `n=15` from upstream so we still have
   10 after dropping the indices).
3. **`components/uoa/UOALeaderboard.jsx`** — new component. Two-column grid
   (`grid-cols-2 gap-2`). Each column is a `<UOALeaderboardColumn side="buyers|sellers" rows={...} maxNotional={...} />`.
4. **`components/uoa/UOALeaderboardRow.jsx`** — single row. Props:
   `{ rank, entry, side, maxNotional, inWatchlist, onActivate }`. Renders
   rank/symbol/netNotional/magnitude bar/B/S split bar/last-trade-relative.
5. **`views/UOAMode.jsx`** — wire the hook, render `<UOALeaderboard ... />`
   between `<UOASummaryStrip />` and the `SignalTape` block. Pass
   `addSymbol` + `setActiveSymbol` from existing `useFlowSignals` so click
   handler does:
   ```js
   if (!watchlist.includes(sym)) addSymbol(sym);
   setActiveSymbol(sym);
   ```
6. **`lib/format.js`** — reuse existing `toB` / money formatters. Add a small
   `relTime(iso)` helper if not present (returns `3s`, `2m`, `1h`).

## Sketch artifact

Update `.planning/sketches/001-uoa-tape/index.html`:
- Add a 4th variant tab **"D: + Leaderboard"** that clones Variant A but
  inserts the leaderboard strip below the summary strip.
- Reuse existing CSS tokens (`--color-bull`, `--color-bear`, `--color-surface`,
  `--color-border-subtle`, `prem-bar` styles) — no new theme work.
- Static demo data from the sample payload (AMD/MU on buyers, SPY/SPX on
  sellers) plus a few fabricated rows to fill to n=5 visible per side.

## Verification

1. Backend
   - `uv run uvicorn backend.main:app --reload --port 8000`
   - `curl http://localhost:8000/api/flow/leaderboard?window=60&n=10`
   - Verify shape matches `LeaderboardResponse`; verify cache (second call
     within 30s does not hit upstream — check logs).
   - With `GEX_ADAPTER=seed`, verify stub returns 200.
2. Frontend
   - `npm run dev`, visit `/uoa` (or wherever UOAMode mounts).
   - Confirm strip renders above the signal tape, polls every 30s, shows
     elapsed counter alongside summary's existing counter.
   - Click a non-watchlist symbol → it appears in `UOAWatchlistRow` and becomes
     the active symbol; signal tape switches to it.
   - Click a watchlisted symbol → it just activates (no duplicate row).
   - Toggle adapter to `seed`, confirm stub data still renders without error.
3. Browser MCP: take a screenshot at desktop width to confirm strip layout
   doesn't crowd the summary strip; check tablet (`sm`) breakpoint — strip
   should stack to single column under `< md`.

## Out of scope (future)

- Window selector (15m / 60m / 240m) — v1 hardcodes 60m
- Historical "biggest mover" sparkline per row
- Click-to-filter signal tape to just that symbol's signals without activating it
