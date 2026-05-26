const BASE = import.meta.env.VITE_API_BASE ?? ''

export async function fetchAllGEX() {
  const res = await fetch(`${BASE}/api/gex`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchGEXBySymbol(symbol, { strikes = 50, expiry = null } = {}) {
  const params = new URLSearchParams({ strikes })
  if (expiry) params.set("expiry", expiry)
  const res = await fetch(`${BASE}/api/gex/${symbol}?${params}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}


export async function fetchIntraday(symbol) {
  const res = await fetch(`${BASE}/api/gex/${symbol}/intraday`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`)
  if (!res.ok) throw new Error(`Health check failed`)
  return res.json()
}

export async function fetchDealerRisk(symbol) {
  const res = await fetch(`${BASE}/api/dealer-risk/${symbol}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchFlowSignals(symbol, { windowMinutes = 240, minScore = 60, intent = null, structure = null, expiry = null, limit = 50 } = {}) {
  const params = new URLSearchParams({ window_minutes: windowMinutes, min_score: minScore, limit })
  if (intent) params.set("intent", intent)
  if (structure) params.set("structure", structure)
  if (expiry) params.set("expiry", expiry)
  const res = await fetch(`${BASE}/api/flow/signals/${symbol}?${params}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchFlowSummary(symbol, { windowMinutes = 240, expiry = null } = {}) {
  const params = new URLSearchParams({ window_minutes: windowMinutes })
  if (expiry) params.set("expiry", expiry)
  const res = await fetch(`${BASE}/api/flow/signals/${symbol}/summary?${params}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchFlowWatchlist(symbols, { windowMinutes = 240 } = {}) {
  const params = new URLSearchParams({ symbols: symbols.join(","), window_minutes: windowMinutes })
  const res = await fetch(`${BASE}/api/flow/signals/watchlist?${params}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}
