import { relTime } from "@/lib/format"

export default function UOALeaderboardRow({ rank, entry, side, maxNotional, inWatchlist, onActivate }) {
  const isBull = side === "buyers"
  const pct = maxNotional > 0 ? Math.abs(entry.netNotional) / maxNotional : 0
  const totalVol = entry.buyVolume + entry.sellVolume
  const buyPct = totalVol > 0 ? entry.buyVolume / totalVol : 0.5
  const sellPct = 1 - buyPct
  const netFmt = isBull
    ? `+$${(entry.netNotional / 1e6).toFixed(1)}M`
    : `−$${(Math.abs(entry.netNotional) / 1e6).toFixed(1)}M`

  return (
    <div
      className="grid gap-x-2 px-2 py-[5px] border-b border-[var(--color-border-subtle)] cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors items-center text-[11px]"
      style={{ gridTemplateColumns: "18px 46px 76px 1fr 36px" }}
      onClick={() => onActivate(entry.symbol)}
      title={inWatchlist ? `Activate ${entry.symbol}` : `Add ${entry.symbol} to watchlist`}
    >
      {/* Rank */}
      <span className="text-[var(--color-text-dim)] font-semibold">{rank}</span>

      {/* Symbol */}
      <span className="font-bold text-[var(--color-text)] flex items-center gap-1">
        {inWatchlist && (
          <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-primary)] shrink-0" />
        )}
        {entry.symbol}
      </span>

      {/* Net $ */}
      <span className={`font-bold font-mono ${isBull ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]"}`}>
        {netFmt}
      </span>

      {/* Magnitude bar + B/S split stacked */}
      <div className="flex flex-col gap-[3px] min-w-0">
        {/* magnitude */}
        <div className="h-[4px] rounded-full bg-[var(--color-border)] overflow-hidden">
          <div
            className={`h-full rounded-full ${isBull ? "bg-[var(--color-bull)]" : "bg-[var(--color-bear)]"}`}
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        {/* B/S split */}
        <div className="h-[4px] rounded-full overflow-hidden flex">
          <div className="bg-[var(--color-bull)] h-full" style={{ width: `${Math.round(buyPct * 100)}%` }} />
          <div className="bg-[var(--color-bear)] h-full" style={{ width: `${Math.round(sellPct * 100)}%` }} />
        </div>
      </div>

      {/* Last trade relative time */}
      <span className="text-right font-mono text-[var(--color-text-muted)]">
        {relTime(entry.lastTradeUtc)}
      </span>
    </div>
  )
}
