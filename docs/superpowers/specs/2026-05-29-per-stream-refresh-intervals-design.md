# Per-Stream Refresh Interval Settings — Design

**Date:** 2026-05-29
**Status:** Approved (design)

## Problem

Every API polling cadence in the frontend is a hardcoded constant scattered
across hooks and views. Traders on metered/rate-limited data feeds have no way
to slow polling down to save API calls and reduce data load. We want each
polling data stream to be user-configurable from the Settings page.

## Scope

**In scope:** Make the *refresh interval* (polling cadence) of each API-driven
poller configurable from Settings, per data stream.

**Out of scope (deferred):**
- **Limit / data-load params** — GEX `strikes` (50), leaderboard `n`, flow
  `windowMinutes` / `minScore`. The original ask mentioned "refresh time **and**
  limit params"; per the scope decision we narrowed to intervals only. Limits
  can be a follow-up.
- **Backend** — untouched. Backend defaults (`strikes`, etc.) stay. This is
  frontend polling cadence only.
- **UOA live filters** — `windowMinutes` / `minScore` remain interactive top-bar
  controls backed by `uoa-filters`. Not moved.

## The 6 data streams

Every API-driven `setInterval` in the frontend (MarketClock's 1s tick and the
per-hook `elapsed` progress ticks are excluded — they are not API calls):

| Key              | Label              | Source                       | Current |
|------------------|--------------------|------------------------------|---------|
| `b3`             | B3 Mode (Net GEX)  | `hooks/useGEXData.js`        | 60s     |
| `watchlist`      | Watchlist GEX      | `views/WatchlistMode.jsx`    | 60s     |
| `expiry`         | Expiry GEX         | `views/ExpiryMode.jsx`       | 60s     |
| `intraday`       | Intraday Chart     | `hooks/useIntraday.js`       | 60s     |
| `uoaSignals`     | UOA Flow Signals   | `hooks/useFlowSignals.js`    | 60s     |
| `uoaLeaderboard` | UOA Leaderboard    | `hooks/useLeaderboard.js`    | 30s     |

## Architecture

### Single source of truth — `lib/refreshSettings.js` (new)

A plain module (no React, no reactive store) over one localStorage key,
`gex.refresh-intervals`, holding `{ b3: 60, watchlist: 60, ... }` merged over
defaults.

```js
export const REFRESH_STREAMS = [
  { key: "b3",             label: "B3 Mode (Net GEX)",   default: 60 },
  { key: "watchlist",      label: "Watchlist GEX",       default: 60 },
  { key: "expiry",         label: "Expiry GEX",          default: 60 },
  { key: "intraday",       label: "Intraday Chart",      default: 60 },
  { key: "uoaSignals",     label: "UOA Flow Signals",    default: 60 },
  { key: "uoaLeaderboard", label: "UOA Leaderboard",     default: 30 },
]

export const REFRESH_PRESETS = [
  { value: 15,  label: "15s" },
  { value: 30,  label: "30s" },
  { value: 60,  label: "1m"  },
  { value: 120, label: "2m"  },
  { value: 300, label: "5m"  },
  { value: 600, label: "10m" },
]

const STORAGE_KEY = "gex.refresh-intervals"
const DEFAULTS = Object.fromEntries(REFRESH_STREAMS.map(s => [s.key, s.default]))
const VALID = new Set(REFRESH_PRESETS.map(p => p.value))

export function getRefreshInterval(key) { /* read+merge, fall back to default; validate against VALID */ }
export function setRefreshInterval(key, seconds) { /* validate, persist merged object */ }
export function getAllRefreshIntervals() { /* merged object for the Settings UI */ }
```

### Why no reactive store

The theme system uses `useSyncExternalStore` because a theme change must repaint
the whole app *while everything stays mounted*. Refresh intervals have no such
requirement: **Settings is its own route**, so every polling view is unmounted
while the user edits intervals and remounts — reading fresh values — on
navigation back. Read-on-mount is therefore sufficient. This deliberately omits
per-hook "restart the timer when the value changes" logic, which was the riskiest
part of the change.

### Consuming the value in each poller

Each poller reads its interval **once on mount** and uses it for both the
`setInterval` delay and the `elapsed` cap:

```js
const [interval] = useState(() => getRefreshInterval("b3")) // seconds
// setInterval(load, interval * 1000)
// setElapsed(e => Math.min(e + 1, interval))
// progress %: elapsed / interval
```

Per-poller notes:
- `useGEXData.js` — replace `const REFRESH_INTERVAL = 60`. The hook returns
  `REFRESH_INTERVAL`; keep returning the resolved value under the same name so
  `TopBar`/consumers need no change.
- `useFlowSignals.js` — replace `const REFRESH_INTERVAL = 60`; same return-name
  contract (`UOATopBar` reads it).
- `useLeaderboard.js` — replace `const REFRESH_INTERVAL = 30`.
- `useIntraday.js` — replace bare `60_000`. Simplest: no pause/elapsed/refresh
  machinery, just the interval delay.
- `ExpiryMode.jsx` — replace local `const REFRESH_INTERVAL = 60` driving the
  `bump` timer.
- `WatchlistMode.jsx` — replace local `const REFRESH_INTERVAL = 60` driving the
  `bump` timer.

### Settings UI — `views/Settings.jsx`

Add a **"Refresh Intervals"** section (matching the existing `Theme` /
`System Info` section styling). One row per stream: the stream label + a preset
`<select>` styled like `ThemePicker`. On change, call `setRefreshInterval(key, value)`
and update local component state so the select reflects the choice immediately.

Replace the static `InfoCard label="Refresh Interval" value="30s"` — it is now
inaccurate and superseded by the new section.

**No "Off"/manual option:** the existing **Pause** button (already in
`useGEXData` and `useFlowSignals`) stops polling entirely. This setting answers
only "how often when active." **Presets only** (no free numeric input) so nobody
can type `1` and hammer the API — the opposite of the goal.

## Data flow

```
Settings.jsx  --setRefreshInterval(key,val)-->  localStorage["gex.refresh-intervals"]
                                                          |
                                                          | getRefreshInterval(key) on mount
                                                          v
                              poller hook/view  -->  setInterval(load, interval*1000)
```

A changed interval takes effect the next time the affected view mounts (i.e.
navigating to it). No live remount of an already-open view is required because
Settings is a separate route.

## Error handling

- `getRefreshInterval` falls back to the stream's default on missing key, parse
  error, or a value not in `VALID`.
- `setRefreshInterval` no-ops on an invalid value.
- All localStorage access wrapped in try/catch (matches `useTheme` /
  `useFlowSignals` patterns).

## Testing / validation

- Set each stream to a non-default preset, navigate to its view, confirm the
  poll cadence and the `elapsed` progress bar match the chosen interval.
- Reload the app → choices persist.
- Corrupt the localStorage value → defaults restored, no crash.
- Pause still fully stops polling regardless of interval.
- UOA live filters (`windowMinutes`/`minScore`) unaffected.
