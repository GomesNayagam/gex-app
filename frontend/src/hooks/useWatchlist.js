import { useState } from "react"

const STORAGE_KEY = "gex.watchlist"
const DEFAULT_WATCHLIST = ["TSLA", "NVDA"]

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_WATCHLIST
}

function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {}
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => load())

  function addTicker(symbol) {
    const upper = symbol.toUpperCase().trim()
    if (!upper) return
    setWatchlist((prev) => {
      if (prev.includes(upper)) return prev
      const next = [...prev, upper]
      save(next)
      return next
    })
  }

  function removeTicker(symbol) {
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== symbol)
      save(next)
      return next
    })
  }

  return { watchlist, addTicker, removeTicker, isLoading: false }
}
