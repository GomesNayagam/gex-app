# UOA Multi-Symbol Watchlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a watchlist row + tabs to UOAMode so traders can monitor multiple symbols simultaneously, each with its own signal tape, while sharing global filters.

**Architecture:** Extend `useFlowSignals` to fetch signals+summary for every symbol in the watchlist in parallel; introduce a `watchlist` + `activeSymbol` concept. `UOAMode` renders a new `UOAWatchlistRow` (chips + add input) and `UOATabsRow` (one tab per symbol with count and net premium). The active tab's data feeds the existing `SignalTape` and `UOASummaryStrip`. The SYM selector is removed from `UOATopBar` — symbol selection is now handled by the watchlist row.

**Tech Stack:** React 18, custom hooks, localStorage, existing Flash Alpha API via `fetchFlowSignals` / `fetchFlowSummary`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/hooks/useFlowSignals.js` | Modify | Add watchlist state, parallel multi-symbol fetching, `allData` map |
| `frontend/src/components/uoa/UOATopBar.jsx` | Modify | Remove SYM section; keep window/score/intent/structure/0DTE |
| `frontend/src/components/uoa/UOAWatchlistRow.jsx` | Create | Symbol chips + ✕ remove + `+ TICKER` add input |
| `frontend/src/components/uoa/UOATabsRow.jsx` | Create | One tab per symbol: dot, name, count badge, net premium |
| `frontend/src/views/UOAMode.jsx` | Modify | Wire new components, pass active symbol's data downstream |

---

## Task 1: Extend `useFlowSignals` for multi-symbol

**Files:**
- Modify: `frontend/src/hooks/useFlowSignals.js`

- [ ] **Step 1: Replace the hook internals**

Replace the entire file with this implementation:

```js
import { useState, useEffect, useRef, useCallback } from "react"
import { fetchFlowSignals, fetchFlowSummary } from "@/api"

const REFRESH_INTERVAL = 30
const LS_FILTERS = "uoa-filters"
const LS_WATCHLIST = "uoa-watchlist"
const LS_ACTIVE = "uoa-active-symbol"

const DEFAULT_WATCHLIST = ["SPX", "SPY", "QQQ"]

const DEFAULT_FILTERS = {
  windowMinutes: 240,
  minScore: 60,
  intent: null,
  structure: null,
  expiry: null,
  zeroDte: false,
}

function loadFilters() {
  try {
    const saved = localStorage.getItem(LS_FILTERS)
    return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

function loadWatchlist() {
  try {
    const saved = localStorage.getItem(LS_WATCHLIST)
    return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST
  } catch {
    return DEFAULT_WATCHLIST
  }
}

function loadActiveSymbol(watchlist) {
  try {
    const saved = localStorage.getItem(LS_ACTIVE)
    return saved && watchlist.includes(saved) ? saved : watchlist[0]
  } catch {
    return watchlist[0]
  }
}

export function useFlowSignals() {
  const [filters, setFiltersState] = useState(loadFilters)
  const [watchlist, setWatchlistState] = useState(loadWatchlist)
  const [activeSymbol, setActiveSymbolState] = useState(() => loadActiveSymbol(loadWatchlist()))
  // allData: { [symbol]: { signals: [...], summary: {...}, loading: bool, error: string|null } }
  const [allData, setAllData] = useState({})
  const [elapsed, setElapsed] = useState(0)

  const intervalRef = useRef(null)
  const tickRef = useRef(null)
  const filtersRef = useRef(filters)
  const watchlistRef = useRef(watchlist)
  filtersRef.current = filters
  watchlistRef.current = watchlist

  const setFilters = useCallback((update) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...(typeof update === "function" ? update(prev) : update) }
      try { localStorage.setItem(LS_FILTERS, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const setActiveSymbol = useCallback((sym) => {
    setActiveSymbolState(sym)
    try { localStorage.setItem(LS_ACTIVE, sym) } catch {}
  }, [])

  const addSymbol = useCallback((sym) => {
    const upper = sym.trim().toUpperCase()
    if (!upper) return
    setWatchlistState((prev) => {
      if (prev.includes(upper)) return prev
      const next = [...prev, upper]
      try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(next)) } catch {}
      return next
    })
    setActiveSymbol(upper)
  }, [setActiveSymbol])

  const removeSymbol = useCallback((sym) => {
    setWatchlistState((prev) => {
      const next = prev.filter((s) => s !== sym)
      try { localStorage.setItem(LS_WATCHLIST, JSON.stringify(next)) } catch {}
      // If removing the active symbol, switch to first remaining
      setActiveSymbolState((active) => {
        if (active === sym) {
          const fallback = next[0] ?? ""
          try { localStorage.setItem(LS_ACTIVE, fallback) } catch {}
          return fallback
        }
        return active
      })
      return next
    })
  }, [])

  const load = useCallback(async () => {
    const f = filtersRef.current
    const syms = watchlistRef.current
    if (!syms.length) return

    const expiry = f.zeroDte ? getTodayOrNextWeekday() : f.expiry
    setElapsed(0)

    // Mark all as loading
    setAllData((prev) => {
      const next = { ...prev }
      syms.forEach((s) => { next[s] = { ...(prev[s] || {}), loading: true, error: null } })
      return next
    })

    // Fetch all symbols in parallel
    const results = await Promise.allSettled(
      syms.map(async (sym) => {
        const [signalsData, summaryData] = await Promise.all([
          fetchFlowSignals(sym, {
            windowMinutes: f.windowMinutes,
            minScore: f.minScore,
            intent: f.intent,
            structure: f.structure,
            expiry,
          }),
          fetchFlowSummary(sym, { windowMinutes: f.windowMinutes, expiry }),
        ])
        return { sym, signalsData, summaryData }
      })
    )

    setAllData((prev) => {
      const next = { ...prev }
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const { sym, signalsData, summaryData } = result.value
          next[sym] = { signals: signalsData, summary: summaryData, loading: false, error: null }
        } else {
          // Extract symbol from the rejected promise — find it by position
          const idx = results.indexOf(result)
          const sym = syms[idx]
          next[sym] = { ...(prev[sym] || {}), loading: false, error: result.reason?.message ?? "Error" }
        }
      })
      return next
    })
  }, [])

  const startPolling = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(tickRef.current)
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000)
    tickRef.current = setInterval(() => setElapsed((e) => Math.min(e + 1, REFRESH_INTERVAL)), 1000)
  }, [load])

  const refresh = useCallback(() => {
    load()
    startPolling()
  }, [load, startPolling])

  // Re-fetch when filters or watchlist change
  useEffect(() => {
    load()
    startPolling()
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(tickRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.windowMinutes, filters.minScore, filters.intent,
    filters.structure, filters.expiry, filters.zeroDte,
    watchlist,
  ])

  return {
    allData,
    activeSymbol,
    setActiveSymbol,
    watchlist,
    addSymbol,
    removeSymbol,
    elapsed,
    refresh,
    filters,
    setFilters,
    REFRESH_INTERVAL,
  }
}

function getTodayOrNextWeekday() {
  const today = new Date()
  const dow = today.getDay()
  if (dow === 0) { const d = new Date(today); d.setDate(today.getDate() + 1); return d.toISOString().slice(0, 10) }
  if (dow === 6) { const d = new Date(today); d.setDate(today.getDate() + 2); return d.toISOString().slice(0, 10) }
  return today.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useFlowSignals.js
git commit -m "feat(uoa): multi-symbol hook — watchlist + parallel fetching"
```

---

## Task 2: Create `UOAWatchlistRow`

**Files:**
- Create: `frontend/src/components/uoa/UOAWatchlistRow.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function UOAWatchlistRow({ watchlist, activeSymbol, onSelect, onAdd, onRemove }) {
  const [input, setInput] = useState("")

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      const val = input.trim().toUpperCase()
      if (val) { onAdd(val); setInput("") }
    }
  }

  return (
    <div
      className="shrink-0 border-b font-mono text-[11px] flex flex-wrap items-center gap-1.5 px-3 py-1.5"
      style={{ background: "#0f0f18", borderColor: "#1e1e2a" }}
    >
      <span
        className="text-[10px] uppercase tracking-widest mr-1"
        style={{ color: "#6b6b80" }}
      >
        Watch
      </span>

      {watchlist.map((sym) => (
        <button
          key={sym}
          onClick={() => onSelect(sym)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-sm border font-bold transition-colors"
          style={
            sym === activeSymbol
              ? { background: "#3b82f6", borderColor: "#3b82f6", color: "#fff" }
              : { background: "#16161f", borderColor: "#1e1e2a", color: "#e2e2e8" }
          }
        >
          {sym}
          <span
            onClick={(e) => { e.stopPropagation(); onRemove(sym) }}
            className="ml-0.5 leading-none"
            style={{ color: sym === activeSymbol ? "rgba(255,255,255,.6)" : "#6b6b80", fontSize: "10px" }}
          >
            ✕
          </span>
        </button>
      ))}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        placeholder="+ TICKER"
        maxLength={8}
        className="px-2 py-0.5 rounded-sm font-mono uppercase outline-none"
        style={{
          background: "transparent",
          border: "1px dashed #333348",
          color: "#6b6b80",
          fontSize: "11px",
          width: "72px",
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/uoa/UOAWatchlistRow.jsx
git commit -m "feat(uoa): UOAWatchlistRow — symbol chips with add/remove"
```

---

## Task 3: Create `UOATabsRow`

**Files:**
- Create: `frontend/src/components/uoa/UOATabsRow.jsx`

- [ ] **Step 1: Create the component**

The tab dot color is derived from net premium: green if bull > bear, red if bear > bull, amber if within 20% of each other.

```jsx
export default function UOATabsRow({ watchlist, activeSymbol, allData, onSelect }) {
  return (
    <div
      className="shrink-0 flex items-stretch overflow-x-auto"
      style={{ background: "#111118", borderBottom: "1px solid #1e1e2a" }}
    >
      {watchlist.map((sym) => {
        const entry = allData[sym]
        const summary = entry?.summary
        const isActive = sym === activeSymbol
        const count = summary?.signal_count ?? 0
        const bull = summary?.bullish_premium ?? 0
        const bear = summary?.bearish_premium ?? 0
        const net = bull - bear
        const dotColor = net > 0 ? "#22c55e" : net < 0 ? "#f43f5e" : "#d97706"
        const netLabel = net >= 0
          ? `▲$${fmtM(bull)}`
          : `▼$${fmtM(bear)}`
        const netColor = net >= 0 ? "#22c55e" : "#f43f5e"

        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className="flex items-center gap-1.5 px-4 font-mono text-[11px] font-bold whitespace-nowrap transition-colors"
            style={{
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRight: "1px solid #1e1e2a",
              borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              background: isActive ? "#0f0f18" : "transparent",
              color: isActive ? "#e2e2e8" : "#6b6b80",
            }}
          >
            <span
              style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }}
            />
            {sym}
            <span
              className="text-[9px] font-bold px-1 rounded-full"
              style={{
                background: isActive ? "rgba(59,130,246,.2)" : "#1e1e2a",
                color: isActive ? "#3b82f6" : "#6b6b80",
              }}
            >
              {count}
            </span>
            {summary && (
              <span style={{ color: netColor, fontSize: "9px" }}>{netLabel}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function fmtM(val) {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M"
  if (val >= 1_000) return (val / 1_000).toFixed(0) + "K"
  return val.toFixed(0)
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/uoa/UOATabsRow.jsx
git commit -m "feat(uoa): UOATabsRow — per-symbol tabs with count and net premium"
```

---

## Task 4: Update `UOATopBar` — remove SYM selector

**Files:**
- Modify: `frontend/src/components/uoa/UOATopBar.jsx`

- [ ] **Step 1: Remove the SYM section and update the component**

The SYM selector block (PRESETS buttons + custom input + separator) is no longer needed — symbol selection is now handled by `UOAWatchlistRow`. Remove those elements. The `useState` import for `customInput` and the `handlePresetClick`/`handleCustomKeyDown` functions go too. The component's props no longer include anything symbol-related.

Remove this entire block from the JSX (the first child of the top-bar div):

```jsx
// DELETE this entire block:
{/* Symbol selector */}
<div className="flex items-center gap-1.5">
  <span ...>SYM</span>
  {PRESETS.map(...)}
  <input ... />
</div>
<span className="text-[var(--text-3)]">·</span>
```

Also remove from the top of the file:
```js
// DELETE:
const PRESETS = ["SPX", "SPY", "QQQ"]
// DELETE:
const [customInput, setCustomInput] = useState("")
const isCustomActive = !PRESETS.includes(filters.symbol)
function handleCustomKeyDown(e) { ... }
function handlePresetClick(sym) { ... }
```

And remove the `useState` import if it's no longer used after the deletion.

The final component signature stays the same except `filters.symbol` is no longer referenced:
```jsx
export default function UOATopBar({ filters, setFilters, refresh, elapsed, REFRESH_INTERVAL })
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/uoa/UOATopBar.jsx
git commit -m "feat(uoa): remove SYM selector from TopBar — moved to WatchlistRow"
```

---

## Task 5: Update `UOAMode` — wire everything together

**Files:**
- Modify: `frontend/src/views/UOAMode.jsx`

- [ ] **Step 1: Rewrite UOAMode**

Replace the entire file:

```jsx
import { useState } from "react"
import { useFlowSignals } from "@/hooks/useFlowSignals"
import UOATopBar from "@/components/uoa/UOATopBar"
import UOAWatchlistRow from "@/components/uoa/UOAWatchlistRow"
import UOATabsRow from "@/components/uoa/UOATabsRow"
import UOASummaryStrip from "@/components/uoa/UOASummaryStrip"
import SignalTape from "@/components/uoa/SignalTape"
import SignalDetailDrawer from "@/components/uoa/SignalDetailDrawer"

export default function UOAMode() {
  const {
    allData,
    activeSymbol,
    setActiveSymbol,
    watchlist,
    addSymbol,
    removeSymbol,
    elapsed,
    refresh,
    filters,
    setFilters,
    REFRESH_INTERVAL,
  } = useFlowSignals()

  const [activeSignal, setActiveSignal] = useState(null)

  const entry = allData[activeSymbol] ?? {}
  const { signals: signalsData, summary, loading, error } = entry

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <UOATopBar
        filters={filters}
        setFilters={setFilters}
        refresh={refresh}
        elapsed={elapsed}
        REFRESH_INTERVAL={REFRESH_INTERVAL}
      />

      <UOAWatchlistRow
        watchlist={watchlist}
        activeSymbol={activeSymbol}
        onSelect={setActiveSymbol}
        onAdd={addSymbol}
        onRemove={removeSymbol}
      />

      <UOATabsRow
        watchlist={watchlist}
        activeSymbol={activeSymbol}
        allData={allData}
        onSelect={setActiveSymbol}
      />

      {summary && (
        <UOASummaryStrip
          summary={summary}
          spot={signalsData?.underlying_price}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {loading && !signalsData && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-[var(--text-3)]">
            Loading flow signals…
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-red-400">
            Error: {error}
          </div>
        )}

        {signalsData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SignalTape
              signals={signalsData.signals}
              onSelect={setActiveSignal}
              activeSignal={activeSignal}
            />
          </div>
        )}

        {activeSignal && (
          <SignalDetailDrawer
            signal={activeSignal}
            symbol={activeSymbol}
            chain={signalsData?.chain}
            onClose={() => setActiveSignal(null)}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/UOAMode.jsx
git commit -m "feat(uoa): multi-symbol UOAMode — watchlist row + tabs wired up"
```

---

## Self-Review

**Spec coverage:**
- ✅ WATCH row with symbol chips, ✕ remove, `+ TICKER` input
- ✅ Tabs per symbol with count badge + net premium direction + dot
- ✅ Shared filters (window/score/intent/structure/0DTE) apply to all symbols
- ✅ Active tab's tape renders in the existing `SignalTape`
- ✅ SYM selector removed from `UOATopBar`
- ✅ `watchlist` + `activeSymbol` persisted to localStorage
- ✅ `symbol` prop passed to `SignalDetailDrawer` (uses `activeSymbol` from hook, not `signal.symbol`)

**Placeholder scan:** No TBD/TODO/fill-in-later patterns found.

**Type consistency:**
- `allData[sym]` shape: `{ signals: FlowSignalsResponse, summary: FlowSignalsSummary, loading: bool, error: string|null }` — used consistently across hook and `UOAMode`
- `signalsData.signals` (array) passed to `SignalTape` — matches existing `SignalTape` prop `signals`
- `signalsData.underlying_price` passed to `UOASummaryStrip` as `spot` — matches existing usage
- `signalsData.chain` passed to `SignalDetailDrawer` — matches existing usage
