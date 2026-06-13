import { cn } from "@/lib/utils"
import { SEGMENT_COLORS } from "@/lib/palette"

const SEGMENTS = [
  { key: "premium",      label: "P", color: SEGMENT_COLORS.premium },
  { key: "size_vs_oi",   label: "S", color: SEGMENT_COLORS.size_vs_oi },
  { key: "aggressor",    label: "A", color: SEGMENT_COLORS.aggressor },
  { key: "sweep",        label: "W", color: SEGMENT_COLORS.sweep },
  { key: "opening_bias", label: "O", color: SEGMENT_COLORS.opening_bias },
  { key: "tenor",        label: "T", color: SEGMENT_COLORS.tenor },
]

export default function ScoreBreakdownBar({ breakdown, score, compact = false }) {
  if (!breakdown) return null
  const total = score || Object.values(breakdown).reduce((a, b) => a + b, 0) || 1

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
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
