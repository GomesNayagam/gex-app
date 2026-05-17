import { useState, useEffect, useRef, useCallback } from "react"
import { fetchAllGEX } from "@/api"

const REFRESH_INTERVAL = 300

export function useGEXData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const intervalRef = useRef(null)
  const tickRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setElapsed(0)
    setRefreshKey(k => k + 1)
    try {
      const json = await fetchAllGEX()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000)
    tickRef.current = setInterval(
      () => setElapsed(e => Math.min(e + 1, REFRESH_INTERVAL)),
      1000
    )
    return () => {
      clearInterval(intervalRef.current)
      clearInterval(tickRef.current)
    }
  }, [load])

  const refresh = useCallback(() => {
    clearInterval(intervalRef.current)
    clearInterval(tickRef.current)
    load()
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000)
    tickRef.current = setInterval(
      () => setElapsed(e => Math.min(e + 1, REFRESH_INTERVAL)),
      1000
    )
  }, [load])

  const bumpRefreshKey = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return { data, loading, error, elapsed, refresh, bumpRefreshKey, REFRESH_INTERVAL, refreshKey }
}
