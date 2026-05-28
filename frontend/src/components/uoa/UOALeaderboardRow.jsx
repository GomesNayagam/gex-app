import { relTime } from "@/lib/format"

export default function UOALeaderboardRow({ rank, entry, side, maxNotional, inWatchlist, onActivate }) {
  const isBull = side === "buyers"
  const pct = maxNotional > 0 ? Math.abs(entry.netNotional) / maxNotional : 0
  const totalVol = (entry.buyVolume ?? 0) + (entry.sellVolume ?? 0)
  const buyPct = totalVol > 0 ? (entry.buyVolume ?? 0) / totalVol : 0.5
  const netFmt = isBull
    ? `+$${((entry.netNotional ?? 0) / 1e6).toFixed(1)}M`
    : `−$${(Math.abs(entry.netNotional ?? 0) / 1e6).toFixed(1)}M`

  return (
    <div
      className="grid gap-x-2 px-3 py-[4px] border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface-2)] transition-colors items-center font-mono text-[11px]"
      style={{ gridTemplateColumns: "16px 42px 72px 1fr 32px" }}
      onClick={() => onActivate(entry.symbol)}
      title={inWatchlist ? `Activate ${entry.symbol}` : `Add ${entry.symbol} to watchlist`}
    >
      <span className="text-[var(--text-3)]">{rank}</span>

      <span className="font-bold text-[var(--text-1)] flex items-center gap-1">
        {inWatchlist && <span className="w-[4px] h-[4px] rounded-full bg-blue-500 shrink-0" />}
        {entry.symbol}
      </span>

      <span className={`font-bold tabular-nums ${isBull ? "text-green-400" : "text-red-400"}`}>
        {netFmt}
      </span>

      <div className="flex flex-col gap-[3px] min-w-0">
        <div className="h-[3px] rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div
            className={`h-full rounded-full ${isBull ? "bg-green-500" : "bg-red-500"}`}
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
        </div>
        <div className="h-[3px] rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full" style={{ width: `${Math.round(buyPct * 100)}%` }} />
          <div className="bg-red-500 h-full flex-1" />
        </div>
      </div>

      <span className="text-right text-[var(--text-3)] tabular-nums">
        {relTime(entry.lastTradeUtc)}
      </span>
    </div>
  )
}
