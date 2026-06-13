import { fmtGex, fmtStrike } from "@/lib/format"
import { cn } from "@/lib/utils"

const MAX_W = 44

const TAG_CLASS = {
  "Call Wall": "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.28)]",
  "γ Flip":    "text-[var(--flip)] bg-[rgba(157,184,255,0.10)] shadow-[inset_0_0_0_1px_rgba(157,184,255,0.28)]",
  "Put Wall":  "text-[var(--rose)] bg-[rgba(240,138,155,0.10)] shadow-[inset_0_0_0_1px_rgba(240,138,155,0.28)]",
}

export default function StrikeRow({ d, symbol, maxNet, maxCall, maxPut, compact = false, tags = [] }) {
  const isPos = d.net_gex >= 0
  const netW  = (Math.abs(d.net_gex) / maxNet) * MAX_W
  const callW = (d.call_gex / maxCall) * MAX_W
  const putW  = (Math.abs(d.put_gex) / maxPut) * MAX_W

  return (
    <div className={cn(
      "group grid items-center min-h-[30px] px-4 border-b border-[rgba(255,255,255,0.025)] overflow-x-hidden",
      compact && "min-h-[20px] py-0.5",
      "grid-cols-[minmax(80px,auto)_1fr_56px] gap-x-0 transition-colors duration-100",
      d.is_flip ? "bg-[rgba(157,184,255,0.04)] hover:bg-[rgba(157,184,255,0.07)]" : "hover:bg-[rgba(255,255,255,0.03)]",
    )}>
      {/* Strike + tags */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn(
          "font-mono tabular-nums text-[10.5px] tracking-wide flex-none text-[var(--slate)]",
          d.is_spot && "text-[var(--ivory)] font-semibold",
        )}>
          {fmtStrike(symbol, d.strike)}
        </span>
        {tags.map((t) => (
          <span
            key={t.label}
            className={cn(
              "font-sans text-[8px] font-semibold tracking-[0.04em] px-[7px] py-px rounded-full whitespace-nowrap",
              TAG_CLASS[t.label] ?? "text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)]",
            )}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Bar area */}
      <div className="relative h-[18px]">
        {/* Center axis */}
        <div className="absolute left-1/2 top-[4px] bottom-[4px] w-px bg-[var(--edge)]" />

        {/* Ghost call bar */}
        <div
          className="absolute top-[4px] left-1/2 h-[2px] rounded-full bg-[var(--mint-deep)] opacity-[0.28]"
          style={{ width: `${callW}%` }}
        />

        {/* Ghost put bar */}
        <div
          className="absolute bottom-[4px] right-1/2 h-[2px] rounded-full bg-[var(--rose-deep)] opacity-[0.28]"
          style={{ width: `${putW}%` }}
        />

        {/* Net bar */}
        {isPos ? (
          <div
            className="absolute top-1/2 left-1/2 h-[6px] -translate-y-1/2 rounded-[4px] bg-gradient-to-r from-[var(--mint-deep)] to-[var(--mint)] shadow-[0_0_10px_rgba(52,210,164,0.35)]"
            style={{ width: `${netW}%` }}
          />
        ) : (
          <div
            className="absolute top-1/2 right-1/2 h-[6px] -translate-y-1/2 rounded-[4px] bg-gradient-to-l from-[var(--rose-deep)] to-[var(--rose)] shadow-[0_0_10px_rgba(224,89,110,0.32)]"
            style={{ width: `${netW}%` }}
          />
        )}
      </div>

      {/* Net GEX value */}
      <span className={cn(
        "font-mono tabular-nums text-[10.5px] text-right tracking-wide",
        isPos ? "text-[var(--mint)]" : "text-[var(--rose)]",
      )}>
        {fmtGex(d.net_gex)}
      </span>
    </div>
  )
}
