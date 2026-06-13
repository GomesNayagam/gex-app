import { fmtPremium } from "@/lib/format"

export default function UOASummaryStrip({ summary, spot }) {
  if (!summary) return null

  const { signal_count, bullish_premium, bearish_premium, net_directional_premium, opening_premium, closing_premium } = summary
  const total = bullish_premium + bearish_premium || 1
  const bullPct = (bullish_premium / total) * 100

  return (
    <div className="shrink-0 border-b border-[var(--edge-soft)] bg-[var(--glass)] px-6 py-2 font-mono text-[11px] flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-[var(--text-1)] tabular-nums">{summary.symbol} {spot?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className="text-[var(--text-3)]">·</span>
      <span className="text-[var(--text-2)]">Signals <span className="text-[var(--text-1)]">{signal_count}</span></span>
      <span className="text-[var(--text-3)]">·</span>

      {/* Bull/Bear premium bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--mint)]">Bull {fmtPremium(bullish_premium)}</span>
        <div className="w-20 h-1.5 bg-[var(--glass-2)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--mint-deep)] to-[var(--mint)] rounded-full" style={{ width: `${bullPct}%` }} />
        </div>
        <span className="text-[var(--rose)]">Bear {fmtPremium(bearish_premium)}</span>
      </div>

      <span className="text-[var(--text-3)]">·</span>
      <span className="text-[var(--text-2)]">Net <span className={net_directional_premium >= 0 ? "text-[var(--mint)]" : "text-[var(--rose)]"}>{net_directional_premium >= 0 ? "+" : ""}{fmtPremium(net_directional_premium)}</span></span>
      <span className="text-[var(--text-3)]">·</span>
      <span className="text-[var(--text-2)]">Opening <span className="text-[var(--text-1)]">{fmtPremium(opening_premium)}</span></span>
      <span className="text-[var(--text-2)]">Closing <span className="text-[var(--text-1)]">{fmtPremium(closing_premium)}</span></span>
    </div>
  )
}
