import { useState, useEffect } from "react"
import { fetchIntraday } from "@/api"

export function useIntraday(symbol, lookback = 6) {
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    fetchIntraday(symbol, lookback)
      .then(setSeries)
      .catch(() => setSeries(null))
      .finally(() => setLoading(false))

    const id = setInterval(() => {
      fetchIntraday(symbol, lookback)
        .then(setSeries)
        .catch(() => {})
    }, 300_000)
    return () => clearInterval(id)
  }, [symbol, lookback])

  return { series, loading }
}
