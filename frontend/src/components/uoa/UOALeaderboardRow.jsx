import { relTime } from "@/lib/format"

export default function UOALeaderboardRow({ rank, entry, side, maxNotional, inWatchlist, onActivate }) {
  const isBull = side === "buyers"
  const pct = maxNotional > 0 ? Math.abs(entry.netNotional ?? 0) / maxNotional : 0
  const totalVol = (entry.buyVolume ?? 0) + (entry.sellVolume ?? 0)
  const buyPct = totalVol > 0 ? (entry.buyVolume ?? 0) / totalVol : 0.5
  const netFmt = isBull
    ? `+$${((entry.netNotional ?? 0) / 1e6).toFixed(1)}M`
    : `−$${(Math.abs(entry.netNotional ?? 0) / 1e6).toFixed(1)}M`

  return (
    <div
      className="grid gap-x-2 items-center cursor-pointer transition-colors font-mono text-[11px]"
      style={{
        gridTemplateColumns: "16px 42px 72px 1fr 32px",
        padding: "4px 12px",
        borderBottom: "1px solid var(--border-soft)",
        background: "transparent",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      onClick={() => onActivate(entry.symbol)}
      title={inWatchlist ? `Activate ${entry.symbol}` : `Add ${entry.symbol} to watchlist`}
    >
      <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{rank}</span>

      <span style={{ fontWeight: 700, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 3 }}>
        {inWatchlist && (
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--blue)", flexShrink: 0, display: "inline-block" }} />
        )}
        {entry.symbol}
      </span>

      <span style={{ fontWeight: 700, color: isBull ? "var(--green)" : "var(--red)", fontVariantNumeric: "tabular-nums" }}>
        {netFmt}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        {/* Magnitude bar */}
        <div style={{ height: 3, borderRadius: 9999, background: "var(--surface-3)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 9999,
            background: isBull ? "var(--green)" : "var(--red)",
            width: `${Math.round(pct * 100)}%`,
          }} />
        </div>
        {/* B/S split bar */}
        <div style={{ height: 3, borderRadius: 9999, overflow: "hidden", display: "flex" }}>
          <div style={{ background: "var(--green)", height: "100%", width: `${Math.round(buyPct * 100)}%` }} />
          <div style={{ background: "var(--red)", height: "100%", flex: 1 }} />
        </div>
      </div>

      <span style={{ textAlign: "right", color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
        {relTime(entry.lastTradeUtc)}
      </span>
    </div>
  )
}
