import { fmtGex, fmtStrike } from "@/lib/format"
import { cn } from "@/lib/utils"

const MAX_W = 44

export default function StrikeRow({ d, symbol, maxNet, maxCall, maxPut, compact = false, tags = [] }) {
  const isPos = d.net_gex >= 0
  const netW  = (Math.abs(d.net_gex) / maxNet) * MAX_W
  const callW = (d.call_gex / maxCall) * MAX_W
  const putW  = (Math.abs(d.put_gex) / maxPut) * MAX_W

  return (
    <div className={cn(
      "group grid items-center min-h-[28px] px-3 border-b border-[var(--border-soft)] overflow-x-hidden",
      compact && "min-h-[20px] py-0.5",
      "grid-cols-[minmax(80px,auto)_1fr_48px] gap-x-0 transition-colors duration-100",
      d.is_flip ? "bg-amber/5 hover:bg-amber/10" : "hover:bg-white/[0.015]",
    )}>
      {/* Strike + tags */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn(
          "font-mono tabular-nums text-[10px] font-medium tracking-wide flex-none",
          "text-[var(--text-2)]",
          d.is_spot && "text-[var(--text-1)] font-semibold",
        )}>
          {fmtStrike(symbol, d.strike)}
        </span>
        {tags.map((t) => (
          <span
            key={t.label}
            className="font-mono text-[7px] uppercase tracking-widest px-1.5 py-px rounded-sm border whitespace-nowrap"
            style={{ color: t.color, borderColor: `${t.color}40`, background: `${t.color}12` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Bar area */}
      <div className="relative h-[18px]">
        {/* Center axis */}
        <div className="absolute left-1/2 top-[2px] bottom-[2px] w-px bg-[var(--border)]" />

        {/* Ghost call bar */}
        <div
          className="absolute top-1/2 left-1/2 h-[3px] -translate-y-[6px] rounded-sm bg-green opacity-20"
          style={{ width: `${callW}%` }}
        />

        {/* Ghost put bar */}
        <div
          className="absolute bottom-1/2 right-1/2 h-[3px] translate-y-[6px] rounded-sm bg-red opacity-20"
          style={{ width: `${putW}%` }}
        />

        {/* Net bar */}
        {isPos ? (
          <div
            className="absolute top-1/2 left-1/2 h-2 -translate-y-1/2 rounded-sm bg-green opacity-85"
            style={{ width: `${netW}%` }}
          />
        ) : (
          <div
            className="absolute top-1/2 right-1/2 h-2 -translate-y-1/2 rounded-sm bg-red opacity-85"
            style={{ width: `${netW}%` }}
          />
        )}

      </div>

      {/* Net GEX value */}
      <span className={cn(
        "font-mono tabular-nums text-[10px] text-right tracking-wide",
        isPos ? "text-green" : "text-red",
      )}>
        {fmtGex(d.net_gex)}
      </span>

    </div>
  )
}
