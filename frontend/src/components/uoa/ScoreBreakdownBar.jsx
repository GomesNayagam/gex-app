import { cn } from "@/lib/utils"

// Colors mirror the sketch: P=blue, S=green, A=amber, W=purple, O=teal, T=slate
const SEGMENTS = [
  { key: "premium",      label: "P", color: "#3b82f6" },
  { key: "size_vs_oi",   label: "S", color: "#22c55e" },
  { key: "aggressor",    label: "A", color: "#f59e0b" },
  { key: "sweep",        label: "W", color: "#a78bfa" },
  { key: "opening_bias", label: "O", color: "#34d399" },
  { key: "tenor",        label: "T", color: "#94a3b8" },
]

export default function ScoreBreakdownBar({ breakdown, score, compact = false }) {
  if (!breakdown) return null
  const total = score || Object.values(breakdown).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex h-2 rounded-sm overflow-hidden gap-px">
        {SEGMENTS.map(({ key, color }) => {
          const val = breakdown[key] || 0
          const pct = (val / total) * 100
          return (
            <div
              key={key}
              className="h-full transition-all"
              style={{ width: `${pct}%`, background: color }}
              title={`${key.replace(/_/g, " ")}: ${val}`}
            />
          )
        })}
      </div>
      {!compact && (
        <div className="flex gap-px">
          {SEGMENTS.map(({ key, label, color }) => (
            <div
              key={key}
              className="text-[8px] font-mono leading-none text-center"
              style={{ width: `${100 / SEGMENTS.length}%`, color }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
