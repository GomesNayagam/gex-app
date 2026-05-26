import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const WINDOW_OPTIONS = [
  { label: "60m", value: 60 },
  { label: "240m", value: 240 },
  { label: "1d", value: 1440 },
]

const INTENT_OPTIONS = ["all", "bullish", "bearish"]
const STRUCTURE_OPTIONS = ["all", "sweep", "block"]

export default function UOATopBar({ filters, setFilters, refresh, elapsed, REFRESH_INTERVAL }) {
  const pct = Math.round((elapsed / REFRESH_INTERVAL) * 100)

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-2 flex flex-wrap items-center gap-3 font-mono text-[11px]">
      {/* Symbol selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-3)]">SYM</span>
        {["SPX", "SPY", "QQQ"].map((sym) => (
          <button
            key={sym}
            onClick={() => setFilters({ symbol: sym })}
            className={cn(
              "px-2 py-0.5 rounded-sm border transition-colors",
              filters.symbol === sym
                ? "border-blue-500 bg-blue-500/10 text-[var(--text-1)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            )}
          >
            {sym}
          </button>
        ))}
      </div>

      <span className="text-[var(--border)]">·</span>

      {/* Window */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-3)]">WIN</span>
        {WINDOW_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilters({ windowMinutes: value })}
            className={cn(
              "px-2 py-0.5 rounded-sm border transition-colors",
              filters.windowMinutes === value
                ? "border-blue-500 bg-blue-500/10 text-[var(--text-1)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="text-[var(--border)]">·</span>

      {/* Min score */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-3)]">SCORE≥</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => setFilters({ minScore: Number(e.target.value) })}
          className="w-20 h-1 accent-blue-500"
        />
        <span className="text-[var(--text-1)] tabular-nums w-5">{filters.minScore}</span>
      </div>

      <span className="text-[var(--border)]">·</span>

      {/* Intent */}
      <div className="flex items-center gap-1">
        {INTENT_OPTIONS.map((v) => (
          <button
            key={v}
            onClick={() => setFilters({ intent: v === "all" ? null : v })}
            className={cn(
              "px-1.5 py-0.5 rounded-sm border transition-colors uppercase tracking-wide",
              (v === "all" ? filters.intent === null : filters.intent === v)
                ? "border-blue-500 bg-blue-500/10 text-[var(--text-1)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Structure */}
      <div className="flex items-center gap-1">
        {STRUCTURE_OPTIONS.map((v) => (
          <button
            key={v}
            onClick={() => setFilters({ structure: v === "all" ? null : v })}
            className={cn(
              "px-1.5 py-0.5 rounded-sm border transition-colors uppercase tracking-wide",
              (v === "all" ? filters.structure === null : filters.structure === v)
                ? "border-blue-500 bg-blue-500/10 text-[var(--text-1)]"
                : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {/* 0DTE */}
      <button
        onClick={() => setFilters((f) => ({ zeroDte: !f.zeroDte, expiry: null }))}
        className={cn(
          "px-2 py-0.5 rounded-sm border transition-colors uppercase tracking-wide",
          filters.zeroDte
            ? "border-amber-500 bg-amber-500/10 text-amber-400"
            : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)]"
        )}
      >
        0DTE
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Progress arc */}
        <div className="relative w-5 h-5">
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2" />
            <circle
              cx="10" cy="10" r="8" fill="none"
              stroke="var(--text-3)" strokeWidth="2"
              strokeDasharray={`${50.27 * pct / 100} 50.27`}
            />
          </svg>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  )
}
