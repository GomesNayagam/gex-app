import { RefreshCw } from "lucide-react"

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

      {/* Window */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-3)]">WIN</span>
        {WINDOW_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilters({ windowMinutes: value })}
            className="px-2 py-0.5 rounded-sm border transition-colors"
            style={filters.windowMinutes === value
              ? { borderColor: "#3b82f6", background: "#3b82f6", color: "#fff" }
              : { borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="text-[var(--text-3)]">·</span>

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

      <span className="text-[var(--text-3)]">·</span>

      {/* Intent */}
      <div className="flex items-center gap-0.5">
        {INTENT_OPTIONS.map((v) => {
          const isActive = v === "all" ? filters.intent === null : filters.intent === v
          const activeStyle =
            v === "bullish" ? { background: "#14532d", color: "#22c55e", borderColor: "#14532d" } :
            v === "bearish" ? { background: "#4c0519", color: "#f43f5e", borderColor: "#4c0519" } :
            { background: "#16161f", color: "#e2e2e8", borderColor: "#333348" }
          return (
            <button
              key={v}
              onClick={() => setFilters({ intent: v === "all" ? null : v })}
              className="px-1.5 py-0.5 rounded-sm border transition-colors uppercase tracking-wide"
              style={isActive ? activeStyle : { borderColor: "var(--border)", color: "var(--text-2)" }}
            >
              {v === "all" ? "ALL" : v === "bullish" ? "▲BULL" : "▼BEAR"}
            </button>
          )
        })}
      </div>

      {/* Structure */}
      <div className="flex items-center gap-0.5">
        {STRUCTURE_OPTIONS.map((v) => {
          const isActive = v === "all" ? filters.structure === null : filters.structure === v
          const activeStyle =
            v === "sweep" ? { background: "#1e3a5f", color: "#3b82f6", borderColor: "#1e3a5f" } :
            { background: "#16161f", color: "#e2e2e8", borderColor: "#333348" }
          return (
            <button
              key={v}
              onClick={() => setFilters({ structure: v === "all" ? null : v })}
              className="px-1.5 py-0.5 rounded-sm border transition-colors uppercase tracking-wide"
              style={isActive ? activeStyle : { borderColor: "var(--border)", color: "var(--text-2)" }}
            >
              {v.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* 0DTE */}
      <button
        onClick={() => setFilters((f) => ({ zeroDte: !f.zeroDte, expiry: null }))}
        className="px-2 py-0.5 rounded-sm border transition-colors uppercase tracking-wide font-bold"
        style={filters.zeroDte
          ? { background: "#2d1b4e", color: "#c084fc", borderColor: "#4a2080" }
          : { borderColor: "var(--border)", color: "var(--text-2)" }}
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
