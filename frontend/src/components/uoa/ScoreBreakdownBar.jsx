import { cn } from "@/lib/utils"

const SEGMENTS = [
  { key: "premium", label: "P", color: "bg-blue-500" },
  { key: "size_vs_oi", label: "S", color: "bg-violet-500" },
  { key: "aggressor", label: "A", color: "bg-cyan-500" },
  { key: "sweep", label: "W", color: "bg-amber-500" },
  { key: "opening_bias", label: "O", color: "bg-emerald-500" },
  { key: "tenor", label: "T", color: "bg-rose-500" },
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
              className={cn("h-full transition-all", color)}
              style={{ width: `${pct}%` }}
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
              className={cn("text-[8px] font-mono leading-none text-center", color.replace("bg-", "text-"))}
              style={{ width: `${100 / SEGMENTS.length}%` }}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
