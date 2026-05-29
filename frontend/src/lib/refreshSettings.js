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
  if (!VALID_KEYS.has(key)) return 60
  const value = readAll()[key]
  return VALID_VALUES.has(value) ? value : DEFAULTS[key]
}

// Persist one stream's interval. No-ops on an invalid key or non-preset value.
export function setRefreshInterval(key, seconds) {
  if (!VALID_KEYS.has(key) || !VALID_VALUES.has(seconds)) return
  try {
    const merged = { ...readAll(), [key]: seconds }
    const next = Object.fromEntries(
      Object.entries(merged).filter(([k]) => VALID_KEYS.has(k)),
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {}
}
