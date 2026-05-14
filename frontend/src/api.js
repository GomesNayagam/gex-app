const BASE = import.meta.env.VITE_API_BASE ?? ''

export async function fetchAllGEX() {
  const res = await fetch(`${BASE}/api/gex`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchGEXBySymbol(symbol, strikes) {
  const params = strikes ? `?strikes=${strikes}` : ''
  const res = await fetch(`${BASE}/api/gex/${symbol}${params}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export async function fetchIntraday(symbol, lookback = 6) {
  const res = await fetch(`${BASE}/api/gex/${symbol}/intraday?lookback=${lookback}`)
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
