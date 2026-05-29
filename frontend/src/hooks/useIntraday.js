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
