import { useState } from "react"
import { cn } from "@/lib/utils"

const ACCENT_BAR = {
  call:   "bg-green",
  flip:   "bg-blue",
  put:    "bg-red",
  pin:    "bg-amber",
  dealer: "bg-purple-400",
}

const VALUE_COLOR = {
  call:   "text-green",
  flip:   "text-blue",
  put:    "text-red",
  pin:    "text-amber",
  dealer: "text-purple-400",
}

// Compact chip — used for the 4-up row
export function StatChip({ type, label, value, sub1, sub2 }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      "relative border border-[var(--border)] bg-[var(--surface-1)] rounded-sm p-3 overflow-hidden",
      "hover:border-[var(--border-soft)] transition-colors"
    )}>
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", ACCENT_BAR[type])} />

      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)] truncate">{label}</span>
        {(sub1 || sub2) && (
          <div className="relative flex-none">
            <button
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={() => setOpen(false)}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              className="text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
              aria-label="More info"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-40 hover:opacity-80">
                <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.25" />
                <text x="6" y="9" textAnchor="middle" fontSize="7.5" fill="currentColor" fontFamily="monospace">?</text>
              </svg>
            </button>
            {open && (
              <div className="absolute bottom-full right-0 mb-1.5 z-50 w-44 rounded-sm border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2 font-mono text-[10px] text-[var(--text-2)] leading-relaxed whitespace-normal">
                <span dangerouslySetInnerHTML={{ __html: sub1 }} />
                {sub2 && <><br /><span>{sub2}</span></>}
              </div>
            )}
          </div>
        )}
      </div>
      <span className={cn("font-mono tabular-nums text-[13px] font-semibold text-[var(--text-1)] leading-none", VALUE_COLOR[type])}>
        {value}
      </span>
    </div>
  )
}

// Wide bar — used for dealer risk
export function StatBar({ type, label, value, sub1, sub2 }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      "relative flex items-center gap-3 border border-[var(--border)] bg-[var(--surface-1)] rounded-sm px-3 py-2 overflow-hidden",
      "hover:border-[var(--border-soft)] transition-colors"
    )}>
      {/* Left accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", ACCENT_BAR[type])} />

      <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)] flex-none ml-1">{label}</span>
      <span className={cn("font-mono tabular-nums text-[13px] font-semibold text-[var(--text-1)] flex-none", VALUE_COLOR[type])}>
        {value}
      </span>
      {sub1 && (
        <span className="font-mono text-[9px] text-[var(--text-2)] truncate flex-1">{sub1}</span>
      )}
      {(sub1 || sub2) && (
        <div className="relative flex-none">
          <button
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            className="text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
            aria-label="More info"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-40 hover:opacity-80">
              <circle cx="6" cy="6" r="5.25" stroke="currentColor" strokeWidth="1.25" />
              <text x="6" y="9" textAnchor="middle" fontSize="7.5" fill="currentColor" fontFamily="monospace">?</text>
            </svg>
          </button>
          {open && (
            <div className="absolute bottom-full right-0 mb-1.5 z-50 w-52 rounded-sm border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-2 font-mono text-[10px] text-[var(--text-2)] leading-relaxed whitespace-normal">
              <span dangerouslySetInnerHTML={{ __html: sub1 }} />
              {sub2 && <><br /><span>{sub2}</span></>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Default export keeps backward compat (uses chip style)
export default function StatCard(props) {
  return <StatChip {...props} />
}
