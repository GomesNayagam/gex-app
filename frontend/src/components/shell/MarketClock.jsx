import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"

function getSession(nyHour, nyMinute) {
  const mins = nyHour * 60 + nyMinute
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return { label: "PRE", variant: "amber" }
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return { label: "REG", variant: "positive" }
  if (mins >= 16 * 60 && mins < 20 * 60) return { label: "POST", variant: "amber" }
  return { label: "CLOSED", variant: "muted" }
}

export default function MarketClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const nyTime = time.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  // Parse NY hour/minute for session
  const nyDate = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const session = getSession(nyDate.getHours(), nyDate.getMinutes())

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] text-[var(--text-3)]">{nyTime} ET</span>
      <Badge variant={session.variant} className="text-[8px] px-1.5 py-0">{session.label}</Badge>
    </div>
  )
}
