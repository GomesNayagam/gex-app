import { Activity, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import MarketClock from "./MarketClock"

function StatusDot({ ok }) {
  return (
    <span className={cn(
      "inline-block w-1.5 h-1.5 rounded-full",
      ok ? "bg-green animate-[pulse_2s_ease-in-out_infinite]" : "bg-red"
    )} />
  )
}

function RefreshBar({ elapsed, total }) {
  const pct = Math.min((elapsed / total) * 100, 100)
  return (
    <div className="absolute bottom-0 left-0 right-0 h-px bg-[var(--border-soft)] overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 bg-blue opacity-50 transition-[width] duration-1000 linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function TopBar({ elapsed, total, loading, error, onRefresh, source }) {
  const now = new Date()
  const tsLabel = now.toISOString().slice(0, 10) + " · " + now.toISOString().slice(11, 19) + " UTC"

  return (
    <div className="relative h-12 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 flex items-center gap-3 shrink-0">
      <Activity size={14} className="text-blue shrink-0" />
      <h1 className="text-sm font-semibold tracking-wide text-[var(--text-1)] hidden sm:block">
        Gamma Exposure Dashboard
      </h1>
      <h1 className="text-sm font-semibold tracking-wide text-[var(--text-1)] sm:hidden">GEX</h1>

      <div className="flex-1" />

      <MarketClock />

      <div className="flex items-center gap-1.5 font-mono text-[9px] text-[var(--text-3)]">
        <StatusDot ok={!error} />
        <span>{error ? "API error" : "API live"}</span>
      </div>

      <div className="font-mono text-[9px] text-[var(--text-3)] text-right hidden md:block">
        <div>{tsLabel}</div>
        <div className="opacity-60 mt-0.5">{source ?? "seed"} · options market structure</div>
      </div>

      <Button onClick={onRefresh} disabled={loading} size="sm">
        <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
        {loading ? "loading…" : "refresh"}
      </Button>

      <RefreshBar elapsed={elapsed} total={total} />
    </div>
  )
}
