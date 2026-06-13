import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

function getSession(nyHour, nyMinute) {
  const mins = nyHour * 60 + nyMinute
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return { label: "PRE-MARKET", live: false }
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return { label: "MARKET OPEN", live: true }
  if (mins >= 16 * 60 && mins < 20 * 60) return { label: "AFTER HOURS", live: false }
  return { label: "MARKET CLOSED", live: false }
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

  const nyDate = new Date(time.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const session = getSession(nyDate.getHours(), nyDate.getMinutes())

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--slate)] bg-[var(--glass)] rounded-full px-3.5 py-[5px] shadow-[inset_0_0_0_1px_var(--edge)]">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          session.live
            ? "bg-[var(--mint)] shadow-[0_0_8px_var(--mint)] animate-breathe"
            : "bg-[var(--slate-dim)]",
        )}
      />
      <span className="whitespace-nowrap">
        {session.label} · {nyTime} ET
      </span>
    </div>
  )
}
