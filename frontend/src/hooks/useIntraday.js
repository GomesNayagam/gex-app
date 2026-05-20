import { useState, useEffect } from "react"
import { fetchIntraday } from "@/api"

export function useIntraday(symbol) {
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(false)

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
    }, 60_000)
    return () => clearInterval(id)
  }, [symbol])

  return { series, loading }
}
