# GEX Dashboard — "Ink & Glass" UI Redesign

**Date:** 2026-06-11
**Status:** Approved (visual mockup approved as-is by user)
**Goal:** Elite-designer-quality, investor-demo-ready UI across the entire frontend. Single design language, no theme switcher. Zero backend changes.
**Reference mockup:** `.superpowers/brainstorm/26329-1781230023/content/full-mockup.html` (approved full-fidelity target for shell + B3 view)

## Decisions Made During Brainstorming

| Decision | Choice |
|---|---|
| Design direction | **B — Ink & Glass** (over Obsidian Tape, Swiss Market) |
| App shell | **A — Icon Rail + Header** (over Top Ribbon, Command Cockpit) |
| Scope | **Everything** — all six views, charts, loading/empty/error states |
| Theming | **Removed entirely** — one palette, no switcher, no `data-theme` |
| Brand | **"GED — Gamma Exposure Dashboard"** kept; rendered as serif italic **"GED."** mark (gold period) |

## 1. Design Language

### Canvas

One fixed radial ink gradient behind the whole app. Panels are translucent glass over it — depth comes from light, not gray-on-gray surfaces.

```css
background: radial-gradient(120% 90% at 18% -10%, #15203a 0%, #0a0e1c 48%, #070a14 100%) fixed;
```

### Tokens (single `:root` set — replaces all three `[data-theme]` blocks)

```css
--ink-0: #070a14;        /* deepest background stop */
--ink-1: #0a0e1c;        /* mid background stop */
--ink-2: #15203a;        /* light background stop (top-left glow) */
--glass:      rgba(255,255,255,0.04);   /* panel fill */
--glass-2:    rgba(255,255,255,0.07);   /* raised/hover fill */
--edge:       rgba(255,255,255,0.09);   /* panel border */
--edge-soft:  rgba(255,255,255,0.05);   /* hairline dividers */
--ivory:      #f0ede6;   /* primary text (warm) */
--slate:      #8fa3c8;   /* secondary text */
--slate-dim:  #5a6b8c;   /* tertiary text / labels */
--gold:       #e8c574;   /* RESERVED: spot price + brand period only */
--mint:       #6ee7c7;   /* positive gamma (bright) */
--mint-deep:  #34d2a4;   /* positive gamma (gradient base) */
--rose:       #f08a9b;   /* negative gamma (bright) */
--rose-deep:  #e0596e;   /* negative gamma (gradient base) */
--flip:       #9db8ff;   /* gamma flip accent (periwinkle) */
```

Chart constants (plain JS export, replaces `useThemeColors`):

```js
// frontend/src/lib/palette.js
export const CHART = {
  grid: "rgba(255,255,255,0.05)",
  axis: "#5a6b8c",
  pos:  "#6ee7c7",
  neg:  "#f08a9b",
  flip: "#9db8ff",
  gold: "#e8c574",
}
```

### Color discipline

- **Gold = the signature + genuine attention states.** Primary, reserved use: spot price values, the spot hairline + pill in ladders, the brand period, the gamma-flip reference line on charts, and input focus rings. Gold is *also* the single sanctioned signal color for true "attention/alert" states where it carries meaning, not decoration — specifically the **paused auto-refresh** state (the pause pill turns gold + the UOA "PAUSED" badge) and the **0DTE risk filter** toggle. It is never used as a generic hover affordance or as chrome decoration. (Resolves the earlier spec/plan contradiction where the plan's migration table mapped legacy amber→gold for "warning states.")
- **Flip (`#9db8ff`) = info / interactive accent.** Generic hover affordances, the score-window/structure filter pills' active state, and links use flip — not gold.
- **Mint = positive / active-navigation; rose = negative.** Mint also marks the active nav-rail item, active tabs, and the market-open dot (semantically "live/go"). Rose marks negative GEX, errors, and destructive hovers.
- **Categorical data-viz colors are a separate, sanctioned set.** Score tiers (`palette.js` `SCORE_TIERS`) and score-breakdown segments (`SEGMENT_COLORS`) draw from a fixed categorical palette (mint / flip / gold / purple `#c9a7f0` / slate) chosen for *distinguishability*, not brand semantics. Gold appearing as one tier/segment color here is intentional and does not dilute its signature role.
- **Glow only on live data**: net bars, chart lines, market-open dot. Never on buttons, borders, or panels.

### Typography (replaces IBM Plex everywhere)

| Role | Font | Usage |
|---|---|---|
| Display | **Instrument Serif** (italic, 400) | Logo "G.", page titles, panel symbol names, section titles |
| UI | **Inter** (400/500/600) | Labels, buttons, body, tags |
| Data | **JetBrains Mono** (400/500/700) | Every number, strike, timestamp, stat |

Google Fonts import replaces the IBM Plex import in `index.css`. Numbers always `tabular-nums`.

### Core surfaces & primitives

- **Panel** (replaces Card): `background: var(--glass); border: 1px solid var(--edge); border-radius: 16px; backdrop-filter: blur(14px); box-shadow: 0 12px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);`
- **Pill** (replaces Badge): fully rounded (`border-radius: 99px`), tinted fill + inset 1px ring of same hue. Variants: `mint` (call wall / +GEX), `rose` (put wall / −GEX), `flip` (periwinkle), `gold` (spot — solid gold fill, ink text), `neutral` (slate).
- **Buttons**: pill-shaped glass (`--glass` fill, `--edge` ring), slate text → ivory on hover. No solid-color primary buttons anywhere in this app.
- **Scrollbars**: 3px, `--edge` thumb.
- **Motion**: existing fadeIn kept; add `breathe` (2.4s opacity pulse) for the market-open dot. Hover transitions 120–150ms. No entrance animation jamborees.

## 2. App Shell

### Icon rail (replaces collapsible `Sidebar.jsx`)

- Fixed **60px** wide, never collapses → **delete `useSidebar.js`** and all collapse logic.
- Frosted: `rgba(255,255,255,0.025)` + blur, hairline right edge.
- Top: brand mark — serif italic **"GED"** with gold "." (~15px, fits the 60px rail), `title="Gamma Exposure Dashboard"`.
- Six icon buttons (lucide icons, 17px, stroke 1.6): Ladders (LayoutGrid), Flow List (Star), Gamma Horizon (CalendarRange), Flow Signals (Flame), Agent (BotMessageSquare), Settings (Settings2) — Settings pinned to bottom via spacer.
- States: tertiary slate default → slate + glass on hover → **active = mint icon on `rgba(110,231,199,0.10)` fill with inset mint ring + faint outer glow**, 11px radius.
- Tooltips via `title` attr (labels live in tooltips now; no text labels).

### Header (replaces `TopBar.jsx`)

- 58px, frosted hairline-bottom strip.
- Left: **page title in Instrument Serif italic ~23px** (changes per route: "Gamma Ladders", "Flow List", "Gamma Horizon", "Flow Signals", "Agent", "Settings") + mono sub-caption in `--slate-dim` (e.g., "SPX · SPY · QQQ — live dealer positioning").
- Right: pause/resume pill button (moves here from B3Mode's toolbar — it's global refresh state), then **market clock pill**: glass pill, breathing mint dot, `MARKET OPEN · 14:32:08 ET` in mono (closed state: static `--slate-dim` dot, "MARKET CLOSED"). `MarketClock.jsx` is restyled, logic kept.
- The UTC timestamp block is removed; the brand lives in the rail (the header carries page titles, not the wordmark).

## 3. Views

### B3 Mode (matches approved mockup exactly)

- Content padding 22–26px; 3-col grid (existing responsive breakpoints kept), 18px gap.
- **Ladder panel** structure preserved (header / stats / column heads / scrollable rows / drag-resize), restyled:
  - Header: symbol in serif italic 22px, regime pill (`+GEX · LONG γ` mint / `−GEX · SHORT γ` rose), spot value right-aligned in **gold mono bold** (no amber Badge).
  - Stats row: `GEX / VEX / CHEX` in mono 10px, labels `--slate-dim`, values mint/rose by sign. The pink `flow_direction` text becomes a neutral slate mono label (pink is off-palette).
  - Column heads: 8px mono uppercase, letterspaced, hairline top+bottom, near-invisible fill.
  - **Strike rows** (30px): strike in mono `--slate`; key-level tags become soft pills (Call Wall mint, γ Flip periwinkle, Put Wall rose); center axis hairline; ghost call/put bars 2px at 28% opacity; **net bar 6px rounded with gradient (`mint-deep→mint` / `rose-deep→rose`) and soft glow shadow**; value right-aligned mono mint/rose.
  - **Spot divider**: gold hairline with transparent ends (`linear-gradient(90deg, transparent, gold 18%, gold 82%, transparent)`) + solid-gold pill `SPOT 6,025.40` (ink text, soft gold glow) right-aligned on the line. Replaces the amber line + bordered label.
  - Drag-resize handle kept, restyled to hairline + `⋯` in `--slate-dim`.
  - Sort-by-net-GEX kept; active sort indicator in mint.
- **Intraday section**: becomes a full glass panel with serif title "Intraday Evolution", mono sub-label, symbol pill-tabs right-aligned (mint active). Pause button no longer here (moved to header).

### Flow List (WatchlistMode)

Same panel system: watchlist controls as glass pills, ticker input as glass input (`--glass` fill, `--edge` ring, ivory text, gold focus ring), 0DTE toggle as pill toggle. Ladders reuse the restyled `InstrumentColumn`.

### Gamma Horizon (ExpiryMode)

Panels and pinned cards become glass panels; expiration selector as pill-tabs; pinned state indicated with a mint pin glyph (gold stays reserved for spot/brand per §1).

### Flow Signals (UOAMode)

The densest view — tape, summary strip, leaderboard, drawer: all surfaces → glass panels; signal score bars → mint/rose gradient bars (same recipe as ladder net bars); row hovers → `rgba(255,255,255,0.03)`; the detail drawer → heavier glass (`--glass-2`, blur 20px, stronger shadow) sliding over the canvas.

### Agent (AgentView)

Chat: user bubbles `--glass-2`, agent bubbles transparent with hairline left rule; serif italic for the agent name; mono for any numeric/tool output; session sidebar list as glass rows with mint active state. Input: glass pill with gold focus ring.

### Settings

- **Theme section deleted** (see §4).
- Remaining sections (endpoint toggle, refresh settings, chat settings) keep the existing sidebar-nav + two-column layout, restyled: nav items as pill rows (mint active), option groups in glass panels, toggles as pill switches (mint when on).

### Charts (IntradayChart, GEXProfileChart)

- Colors from `CHART` constant (§1). Grid hairlines at 5% white; axes `--slate-dim` mono 9–10px JetBrains Mono.
- Net GEX line: mint 2px with `drop-shadow(0 0 6px rgba(110,231,199,0.45))`, gradient area fill (mint 25% → 0), live-end dot with glow.
- Gamma flip reference line: dashed gold at 35% opacity, labeled `γ flip` in mono.
- GEXProfileChart bars: mint/rose with rounded tops (still not wired into a view — unchanged scope).
- Tooltips: glass panel style, mono values.

### Loading / empty / error states

- `LoadingSkeleton.jsx` / `skeleton.jsx`: shimmer runs over glass fills (`--glass` base, `--glass-2` highlight), panel-shaped, matching the new grid.
- Error states: glass panel with rose inset ring, rose mono title, slate body. (Replaces `border-red/25 bg-red/5`.)
- Empty states: centered serif italic line + mono sub-caption in `--slate-dim`.

## 4. Theme Code Removal

1. **Delete `frontend/src/hooks/useTheme.js`** — `THEMES`, `useTheme`, `useThemeColors`, the `gex.theme` localStorage key, listener machinery: all gone.
2. **New `frontend/src/lib/palette.js`** exporting `CHART` (§1). `IntradayChart.jsx` and `GEXProfileChart.jsx` import it instead of `useThemeColors`.
3. **`index.css`**: the three `[data-theme]` blocks (`dark`, `light`, `bloomberg`) collapse into one `:root` block with the new tokens. Legacy var names that components reference (`--bg`, `--surface-1/2/3`, `--border`, `--border-soft`, `--border-color`, `--green`, `--red`, `--blue`, `--amber`, `--*-dim`, `--text-1/2/3`, `--chart-*`, shadcn HSL vars) are **kept as aliases pointing at new palette values** so unmigrated classes degrade gracefully during the rewrite; remove aliases that end up unused at the end.
4. **`tailwind.config.js`**: font families → Instrument Serif (`font-display`), Inter (`font-sans`), JetBrains Mono (`font-mono`); add token colors (`ink`, `glass`, `edge`, `ivory`, `slate`, `gold`, `mint`, `rose`, `flip`); keep legacy color names mapped to CSS vars (which now resolve to the new palette). Remove `darkMode: ["class"]` (no theme switching).
5. **`Settings.jsx`**: remove the theme/appearance section and its nav entry.
6. **`index.html`**: remove any `data-theme` bootstrap script if present; `<title>` becomes "GED — Gamma Exposure Dashboard"; theme-color meta set to ink.
7. Grep-verify: zero remaining references to `useTheme`, `useThemeColors`, `data-theme`, `gex.theme`, `THEMES`, `bloomberg`.

## 5. Explicitly Unchanged

- **Backend**: zero changes.
- **Hooks/state**: `useGEXData`, `useIntraday`, `useWatchlist`, `useFlowSignals`, `useAISessions`, `useLeaderboard`, refresh/chat settings libs — untouched (only `useTheme` and `useSidebar` are deleted).
- **Routing** (React Router v6 routes), `api.js`, `lib/format.js`, `lib/utils.js`.
- **Behaviors**: 30s auto-refresh + pause, ladder sort, drag-resize with localStorage persistence, auto-scroll-to-spot, watchlist persistence, pinned panels, responsive breakpoints.

## 6. Validation

- `cd frontend && npm run build` passes with no unused-import or missing-module errors.
- Grep checks from §4.7 return nothing.
- Browser MCP walkthrough (per CLAUDE.md dev flow) of all six routes against the approved mockup: rail active states, header per route, ladder fidelity (gold spot line, glowing bars, pills), charts, Settings without theme section, loading and error states (kill backend to verify error panel).
- Visual acceptance bar: side-by-side with `.superpowers/brainstorm/26329-1781230023/content/full-mockup.html` — the real B3 view should be indistinguishable in structure, color, and type.
