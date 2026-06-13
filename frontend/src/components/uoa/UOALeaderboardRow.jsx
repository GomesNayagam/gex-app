import { relTime, fmtOI } from "@/lib/format"

export default function UOALeaderboardRow({ rank, entry, side, inWatchlist, onActivate }) {
  const isBull = side === "buyers"
  const buyVol = entry.buyVolume ?? 0
  const sellVol = entry.sellVolume ?? 0
  const totalVol = buyVol + sellVol
  const buyPct = totalVol > 0 ? buyVol / totalVol : 0.5
  const sellPct = 1 - buyPct
  const netFmt = isBull
    ? `+$${((entry.netNotional ?? 0) / 1e6).toFixed(1)}M`
    : `−$${(Math.abs(entry.netNotional ?? 0) / 1e6).toFixed(1)}M`

  const buyLabel = fmtOI(buyVol)
  const sellLabel = fmtOI(sellVol)

  // only show label if the segment is wide enough to fit text (~28% min)
  const showBuyLabel = buyPct >= 0.28
  const showSellLabel = sellPct >= 0.28

  return (
    <div
      className="grid gap-x-2 items-center cursor-pointer font-mono text-[11px]"
      style={{
        gridTemplateColumns: "16px 42px 72px 1fr 32px",
        padding: "4px 12px",
        borderBottom: "1px solid var(--edge-soft)",
        background: "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--glass-2)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      onClick={() => onActivate(entry.symbol)}
      title={inWatchlist ? `Activate ${entry.symbol}` : `Add ${entry.symbol} to watchlist`}
    >
      <span style={{ color: "var(--slate-dim)", fontWeight: 600 }}>{rank}</span>

      <span style={{ fontWeight: 700, color: "var(--ivory)", display: "flex", alignItems: "center", gap: 3 }}>
        {inWatchlist && (
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--mint)", flexShrink: 0, display: "inline-block" }} />
        )}
        {entry.symbol}
      </span>

      <span style={{ fontWeight: 700, color: isBull ? "var(--mint)" : "var(--rose)", fontVariantNumeric: "tabular-nums" }}>
        {netFmt}
      </span>

      {/* B/S volume bar with inline labels */}
      <div style={{
        height: 14, borderRadius: 7, overflow: "hidden",
        display: "flex", background: "var(--glass-2)",
      }}>
        {/* Buy segment */}
        <div style={{
          width: `${Math.round(buyPct * 100)}%`,
          background: "rgba(110,231,199,0.12)",
          borderRight: "1px solid var(--edge)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          transition: "width 0.3s ease",
        }}>
          {showBuyLabel && (
            <span style={{ fontSize: 9, color: "var(--mint)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", padding: "0 3px" }}>
              {buyLabel}
            </span>
          )}
        </div>
        {/* Sell segment */}
        <div style={{
          flex: 1,
          background: "var(--red-dim)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {showSellLabel && (
            <span style={{ fontSize: 9, color: "var(--rose)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", padding: "0 3px" }}>
              {sellLabel}
            </span>
          )}
        </div>
      </div>

      <span style={{ textAlign: "right", color: "var(--slate-dim)", fontVariantNumeric: "tabular-nums" }}>
        {relTime(entry.lastTradeUtc)}
      </span>
    </div>
  )
}
