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
