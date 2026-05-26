import { useState, useEffect, useRef, useCallback } from "react"
import { fetchFlowSignals, fetchFlowSummary } from "@/api"

const REFRESH_INTERVAL = 30
const LS_KEY = "uoa-filters"

const DEFAULT_FILTERS = {
  symbol: "SPX",
  windowMinutes: 240,
  minScore: 60,
  intent: null,
  structure: null,
  expiry: null,
  zeroDte: false,
}

function loadFilters() {
  try {
    const saved = localStorage.getItem(LS_KEY)
    return saved ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

export function useFlowSignals() {
  const [filters, setFiltersState] = useState(loadFilters)
  const [data, setData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)
  const tickRef = useRef(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const setFilters = useCallback((update) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...(typeof update === "function" ? update(prev) : update) }
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const load = useCallback(async () => {
    const f = filtersRef.current
    const expiry = f.zeroDte ? getTodayOrNextMonday() : f.expiry
    setLoading(true)
    setError(null)
    setElapsed(0)
    try {
      const [signalsData, summaryData] = await Promise.all([
        fetchFlowSignals(f.symbol, {
          windowMinutes: f.windowMinutes,
          minScore: f.minScore,
          intent: f.intent,
          structure: f.structure,
          expiry,
        }),
        fetchFlowSummary(f.symbol, { windowMinutes: f.windowMinutes, expiry }),
      ])
      setData(signalsData)
      setSummary(summaryData)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
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

  useEffect(() => {
    load()
    startPolling()
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(tickRef.current)
    }
  }, [load, startPolling])

  useEffect(() => {
    load()
    startPolling()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.symbol, filters.windowMinutes, filters.minScore, filters.intent, filters.structure, filters.expiry, filters.zeroDte])

  return { data, summary, loading, error, elapsed, refresh, filters, setFilters, REFRESH_INTERVAL }
}

function getTodayOrNextMonday() {
  const today = new Date()
  const dow = today.getDay() // 0=Sun, 6=Sat
  if (dow === 0) {
    const next = new Date(today)
    next.setDate(today.getDate() + 1)
    return next.toISOString().slice(0, 10)
  }
  if (dow === 6) {
    const next = new Date(today)
    next.setDate(today.getDate() + 2)
    return next.toISOString().slice(0, 10)
  }
  return today.toISOString().slice(0, 10)
}
