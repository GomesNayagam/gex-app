# Per-Stream Refresh Interval Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure each API poller's refresh cadence from the Settings page, per data stream, to reduce API calls and data load.

**Architecture:** A single plain-JS module (`lib/refreshSettings.js`) is the source of truth, persisting per-stream intervals (seconds) to one localStorage key. The Settings page writes via a preset `<select>` per stream; each polling hook/view reads its interval once on mount (read-on-mount — no reactive store, because Settings is a separate route so polling views are unmounted while editing and remount with fresh values).

**Tech Stack:** React 18, Vite, Tailwind v3, localStorage. No frontend test runner exists in this repo; validation is `npm run build` (compile check), a `node` smoke test for the pure module logic, and manual browser checks — matching the project's existing dev flow.

**Spec:** `docs/superpowers/specs/2026-05-29-per-stream-refresh-intervals-design.md`

**Stream defaults (from spec — note these intentionally differ from current code for UOA):**

| Key | Default | Current code |
|---|---|---|
| `b3` | 60 | 60 |
| `watchlist` | 60 | 60 |
| `expiry` | 60 | 60 |
| `intraday` | 60 | 60 |
| `uoaSignals` | 30 | 60 (changed by spec) |
| `uoaLeaderboard` | 60 | 30 (changed by spec) |

All commands run from `frontend/` unless noted. The dev server may be running; `npm run build` is the safe compile check.

---

### Task 1: Create the `refreshSettings` source-of-truth module

**Files:**
- Create: `frontend/src/lib/refreshSettings.js`
- Test: ad-hoc `node` smoke test (no runner in repo)

- [ ] **Step 1: Write the module**

Create `frontend/src/lib/refreshSettings.js`:

```js
// Single source of truth for per-stream API refresh intervals (seconds).
// Plain module (no React, no reactive store): Settings is its own route, so
// polling views are unmounted while the user edits and remount — reading fresh
// values via getRefreshInterval — on navigation back. Read-on-mount suffices.

export const REFRESH_STREAMS = [
  { key: "b3",             label: "B3 Mode (Net GEX)", default: 60 },
  { key: "watchlist",      label: "Watchlist GEX",     default: 60 },
  { key: "expiry",         label: "Expiry GEX",        default: 60 },
  { key: "intraday",       label: "Intraday Chart",    default: 60 },
  { key: "uoaSignals",     label: "UOA Flow Signals",  default: 30 },
  { key: "uoaLeaderboard", label: "UOA Leaderboard",   default: 60 },
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
const DEFAULTS = Object.fromEntries(REFRESH_STREAMS.map((s) => [s.key, s.default]))
const VALID_KEYS = new Set(REFRESH_STREAMS.map((s) => s.key))
const VALID_VALUES = new Set(REFRESH_PRESETS.map((p) => p.value))

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    return { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}

// Merged map of every stream → its current interval (seconds). For the UI.
export function getAllRefreshIntervals() {
  const merged = readAll()
  // Coerce any invalid persisted value back to its default.
  for (const key of VALID_KEYS) {
    if (!VALID_VALUES.has(merged[key])) merged[key] = DEFAULTS[key]
  }
  return merged
}

// Current interval (seconds) for one stream. Falls back to default on any issue.
export function getRefreshInterval(key) {
  const fallback = DEFAULTS[key] ?? 60
  if (!VALID_KEYS.has(key)) return fallback
  const value = readAll()[key]
  return VALID_VALUES.has(value) ? value : fallback
}

// Persist one stream's interval. No-ops on an invalid key or non-preset value.
export function setRefreshInterval(key, seconds) {
  if (!VALID_KEYS.has(key) || !VALID_VALUES.has(seconds)) return
  try {
    const next = { ...readAll(), [key]: seconds }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {}
}
```

- [ ] **Step 2: Smoke-test the pure logic with node**

The module uses `localStorage`; shim it inline. Run from `frontend/`:

```bash
node --input-type=module -e '
import { getRefreshInterval, setRefreshInterval, getAllRefreshIntervals } from "./src/lib/refreshSettings.js";
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } };

// defaults
assert(getRefreshInterval("b3") === 60, "b3 default 60");
assert(getRefreshInterval("uoaSignals") === 30, "uoaSignals default 30");
assert(getRefreshInterval("uoaLeaderboard") === 60, "uoaLeaderboard default 60");
// unknown key → fallback 60
assert(getRefreshInterval("nope") === 60, "unknown key fallback");
// valid set + read back
setRefreshInterval("b3", 300);
assert(getRefreshInterval("b3") === 300, "b3 persisted 300");
// invalid value no-ops (stays 300)
setRefreshInterval("b3", 7);
assert(getRefreshInterval("b3") === 300, "invalid value ignored");
// invalid key no-ops
setRefreshInterval("nope", 60);
assert(!("nope" in JSON.parse(store["gex.refresh-intervals"])), "invalid key not written");
// corrupt storage → defaults, no throw
store["gex.refresh-intervals"] = "{ not json";
assert(getRefreshInterval("b3") === 60, "corrupt → default");
assert(getAllRefreshIntervals().expiry === 60, "getAll merges defaults on corrupt");
console.log("OK: all refreshSettings assertions passed");
'
```

Expected: `OK: all refreshSettings assertions passed`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/refreshSettings.js
git commit -m "feat: add refreshSettings source-of-truth module"
```

---

### Task 2: Add the Refresh Intervals section to Settings

**Files:**
- Modify: `frontend/src/views/Settings.jsx`

- [ ] **Step 1: Add imports**

At the top of `frontend/src/views/Settings.jsx`, add after the existing imports (after `import { useTheme } ...`):

```jsx
import { useState } from "react"
import {
  REFRESH_STREAMS,
  REFRESH_PRESETS,
  getAllRefreshIntervals,
  setRefreshInterval,
} from "@/lib/refreshSettings"
```

- [ ] **Step 2: Add the RefreshIntervals component**

Add this component above `export default function Settings()` (after `ThemePicker`):

```jsx
function RefreshIntervals() {
  const [intervals, setIntervals] = useState(() => getAllRefreshIntervals())

  function update(key, value) {
    setRefreshInterval(key, value)
    setIntervals((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-3">
      {REFRESH_STREAMS.map((stream) => (
        <div key={stream.key} className="flex items-center justify-between gap-3">
          <label
            htmlFor={`refresh-${stream.key}`}
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-2)]"
          >
            {stream.label}
          </label>
          <select
            id={`refresh-${stream.key}`}
            value={intervals[stream.key]}
            onChange={(e) => update(stream.key, Number(e.target.value))}
            className="font-mono text-[11px] uppercase tracking-wider bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--blue)] cursor-pointer"
          >
            {REFRESH_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="font-mono text-[9px] leading-relaxed text-[var(--text-3)]">
        How often each view polls the API. Use the Pause button in a view to
        stop polling entirely. Changes apply when you next open the view.
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Render the section and remove the stale InfoCard**

In `export default function Settings()`, add a new `<section>` after the Theme section and before System Info:

```jsx
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
            Refresh Intervals
          </h2>
          <RefreshIntervals />
        </section>
```

In the existing System Info section, **delete** this now-inaccurate line:

```jsx
          <InfoCard label="Refresh Interval" value="30s" accent="bg-green" />
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Settings.jsx
git commit -m "feat: add per-stream Refresh Intervals settings UI"
```

---

### Task 3: Wire useGEXData (b3)

**Files:**
- Modify: `frontend/src/hooks/useGEXData.js`

- [ ] **Step 1: Replace the module constant with a per-mount read**

In `frontend/src/hooks/useGEXData.js`, change the import line and remove the constant. Replace:

```js
import { fetchAllGEX } from "@/api";

const REFRESH_INTERVAL = 60
```

with:

```js
import { fetchAllGEX } from "@/api";
import { getRefreshInterval } from "@/lib/refreshSettings";
```

- [ ] **Step 2: Read the interval inside the hook**

Immediately after `export function useGEXData() {`, add as the first line of the body:

```js
  const [REFRESH_INTERVAL] = useState(() => getRefreshInterval("b3"));
```

(The hook already imports `useState`. `REFRESH_INTERVAL` keeps its name, so `startIntervals`, the `elapsed` cap, and the returned value all keep working — `setInterval(load, REFRESH_INTERVAL * 1000)` now uses the configured value, and the returned `REFRESH_INTERVAL` drives the consumer progress bar.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useGEXData.js
git commit -m "feat: drive useGEXData refresh from settings (b3)"
```

---

### Task 4: Wire useFlowSignals (uoaSignals)

**Files:**
- Modify: `frontend/src/hooks/useFlowSignals.js`

- [ ] **Step 1: Replace the module constant**

In `frontend/src/hooks/useFlowSignals.js`, change the import line:

```js
import { fetchFlowSignals, fetchFlowSummary } from "@/api";
```

to:

```js
import { fetchFlowSignals, fetchFlowSummary } from "@/api";
import { getRefreshInterval } from "@/lib/refreshSettings";
```

and delete the line:

```js
const REFRESH_INTERVAL = 60;
```

- [ ] **Step 2: Read the interval inside the hook**

Immediately after `export function useFlowSignals() {`, add as the first line of the body:

```js
  const [REFRESH_INTERVAL] = useState(() => getRefreshInterval("uoaSignals"));
```

(`useState` is already imported. The name `REFRESH_INTERVAL` is preserved, so `startPolling`, the `elapsed` cap, and the returned `REFRESH_INTERVAL` that `UOATopBar` reads all continue to work.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useFlowSignals.js
git commit -m "feat: drive useFlowSignals refresh from settings (uoaSignals)"
```

---

### Task 5: Wire useLeaderboard (uoaLeaderboard)

**Files:**
- Modify: `frontend/src/hooks/useLeaderboard.js`

- [ ] **Step 1: Replace the module constant**

In `frontend/src/hooks/useLeaderboard.js`, change the import line:

```js
import { fetchLeaderboard } from "@/api";
```

to:

```js
import { fetchLeaderboard } from "@/api";
import { getRefreshInterval } from "@/lib/refreshSettings";
```

and delete the line:

```js
const REFRESH_INTERVAL = 30;
```

- [ ] **Step 2: Read the interval inside the hook**

The hook signature is `export function useLeaderboard({ window = 60, n = 10 } = {}) {`. Add as the first line of the body:

```js
  const [REFRESH_INTERVAL] = useState(() => getRefreshInterval("uoaLeaderboard"));
```

(`useState` is already imported. `refresh` uses `REFRESH_INTERVAL` for both the poll `setInterval` and the `elapsed` cap, and the hook returns `REFRESH_INTERVAL` — all preserved by keeping the name.)

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useLeaderboard.js
git commit -m "feat: drive useLeaderboard refresh from settings (uoaLeaderboard)"
```

---

### Task 6: Wire useIntraday (intraday)

**Files:**
- Modify: `frontend/src/hooks/useIntraday.js`

- [ ] **Step 1: Replace the whole hook**

`useIntraday.js` has no pause/elapsed/refresh machinery — just a bare `60_000`. Replace the entire file contents with:

```js
import { useState, useEffect } from "react"
import { fetchIntraday } from "@/api"
import { getRefreshInterval } from "@/lib/refreshSettings"

export function useIntraday(symbol) {
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(false)
  const [intervalSec] = useState(() => getRefreshInterval("intraday"))

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetchIntraday(symbol)
      .then(setSeries)
      .catch(() => setSeries(null))
      .finally(() => setLoading(false))

    const id = setInterval(() => {
      fetchIntraday(symbol)
        .then(setSeries)
        .catch(() => {})
    }, intervalSec * 1000)
    return () => clearInterval(id)
  }, [symbol, intervalSec])

  return { series, loading }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useIntraday.js
git commit -m "feat: drive useIntraday refresh from settings (intraday)"
```

---

### Task 7: Wire ExpiryMode (expiry)

**Files:**
- Modify: `frontend/src/views/ExpiryMode.jsx`

- [ ] **Step 1: Add the import**

Confirm `getRefreshInterval` is imported in `ExpiryMode.jsx`. If not present, add to the imports at the top:

```js
import { getRefreshInterval } from "@/lib/refreshSettings"
```

- [ ] **Step 2: Remove the module constant**

Delete this line (currently at module scope, line ~85):

```js
const REFRESH_INTERVAL = 60
```

- [ ] **Step 3: Read the interval inside the component**

In `export default function ExpiryMode() {`, add after the existing `const intervalRef = useRef(null);` line:

```js
  const [refreshInterval] = useState(() => getRefreshInterval("expiry"));
```

- [ ] **Step 4: Update both setInterval references**

In the `useEffect`, change:

```js
    intervalRef.current = setInterval(bump, REFRESH_INTERVAL * 1000);
```

to:

```js
    intervalRef.current = setInterval(bump, refreshInterval * 1000);
```

In `togglePause`, change:

```js
        intervalRef.current = setInterval(bump, REFRESH_INTERVAL * 1000);
```

to:

```js
        intervalRef.current = setInterval(bump, refreshInterval * 1000);
```

(Add `refreshInterval` to the `useEffect` dependency array: change `}, [bump]);` to `}, [bump, refreshInterval]);`.)

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/ExpiryMode.jsx
git commit -m "feat: drive ExpiryMode refresh from settings (expiry)"
```

---

### Task 8: Wire WatchlistMode (watchlist)

**Files:**
- Modify: `frontend/src/views/WatchlistMode.jsx`

- [ ] **Step 1: Add the import**

Confirm `getRefreshInterval` is imported in `WatchlistMode.jsx`. If not present, add to the imports at the top:

```js
import { getRefreshInterval } from "@/lib/refreshSettings"
```

- [ ] **Step 2: Remove the module constant**

Delete this line (currently at module scope, line ~92):

```js
const REFRESH_INTERVAL = 60
```

- [ ] **Step 3: Read the interval inside the component**

In `export default function WatchlistMode() {`, add after the existing `const intervalRef = useRef(null);` line:

```js
  const [refreshInterval] = useState(() => getRefreshInterval("watchlist"));
```

- [ ] **Step 4: Update both setInterval references**

In the `useEffect`, change:

```js
    intervalRef.current = setInterval(bump, REFRESH_INTERVAL * 1000);
```

to:

```js
    intervalRef.current = setInterval(bump, refreshInterval * 1000);
```

In `togglePause`, change:

```js
        intervalRef.current = setInterval(bump, REFRESH_INTERVAL * 1000);
```

to:

```js
        intervalRef.current = setInterval(bump, refreshInterval * 1000);
```

(Add `refreshInterval` to the `useEffect` dependency array: change `}, [bump]);` to `}, [bump, refreshInterval]);`.)

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/WatchlistMode.jsx
git commit -m "feat: drive WatchlistMode refresh from settings (watchlist)"
```

---

### Task 9: End-to-end browser validation

**Files:** none (manual validation, per project dev flow)

- [ ] **Step 1: Start the app**

From repo root: `./start.sh` (or `cd frontend && npm run dev`). Open the app.

- [ ] **Step 2: Verify the Settings UI**

Go to Settings. Confirm a "Refresh Intervals" section lists all 6 streams with preset dropdowns. Confirm UOA Flow Signals shows **30s** and UOA Leaderboard shows **1m** (spec defaults); the other four show **1m**. Confirm the old "Refresh Interval: 30s" InfoCard is gone.

- [ ] **Step 3: Verify a change persists and applies**

Set "B3 Mode (Net GEX)" to **5m**. Reload the page → Settings still shows 5m. Navigate to `/` (B3). Confirm the TopBar refresh progress bar now fills over 5 minutes (not 60s). Verify in the browser Network tab that `/api/gex` is not re-fetched at 60s.

- [ ] **Step 4: Verify Pause still works**

In B3, click Pause → confirm polling stops entirely regardless of the interval. Resume → polling restarts.

- [ ] **Step 5: Verify defaults survive corruption**

In devtools console: `localStorage.setItem("gex.refresh-intervals", "{ broken")`. Reload. Confirm Settings shows all defaults and no crash.

- [ ] **Step 6: Confirm UOA live filters unaffected**

Open UOA. Confirm `windowMinutes` / `minScore` top-bar controls still work as before (independent of refresh settings).
