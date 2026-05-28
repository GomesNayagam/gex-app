import UOALeaderboardRow from "./UOALeaderboardRow"

function LeaderboardColumn({ side, rows, watchlist, onActivate }) {
  const isBull = side === "buyers"
  const maxNotional = rows.length > 0 ? Math.abs(rows[0].netNotional) : 1
  const label = isBull ? "▲ Buyers" : "▼ Sellers"
  const labelColor = isBull ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]"

  return (
    <div className={`flex flex-col border-[var(--color-border)] ${isBull ? "" : "border-l"}`}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-[4px] bg-[var(--color-surface-2)] border-b border-[var(--color-border-subtle)]">
        <span className={`text-[10px] font-bold tracking-widest uppercase ${labelColor}`}>{label}</span>
        <span className="text-[9px] text-[var(--color-text-dim)] ml-auto">NET $ · B/S · LAST</span>
      </div>
      {/* Col grid header */}
      <div
        className="grid gap-x-2 px-2 py-[3px] text-[9px] text-[var(--color-text-dim)] tracking-widest uppercase border-b border-[var(--color-border-subtle)]"
        style={{ gridTemplateColumns: "18px 46px 76px 1fr 36px" }}
      >
        <span>#</span><span>SYM</span><span>NET $</span><span>MAG · B/S</span><span className="text-right">LAST</span>
      </div>
      {/* Rows */}
      {rows.length === 0 ? (
        <div className="px-2 py-3 text-[11px] text-[var(--color-text-dim)] text-center">No data</div>
      ) : (
        rows.map((entry, i) => (
          <UOALeaderboardRow
            key={entry.symbol}
            rank={i + 1}
            entry={entry}
            side={side}
            maxNotional={maxNotional}
            inWatchlist={watchlist.includes(entry.symbol)}
            onActivate={onActivate}
          />
        ))
      )}
    </div>
  )
}

export default function UOALeaderboard({ data, loading, error, watchlist, onActivate }) {
  if (loading && !data) {
    return (
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-[var(--color-text-dim)] font-mono">
        Loading leaderboard…
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] text-red-400 font-mono">
        Leaderboard error: {error}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
      {/* Strip header */}
      <div className="flex items-center gap-2 px-3 py-[4px] bg-[#0d0d14] border-b border-[var(--color-border)] text-[10px]">
        <span className="font-bold tracking-widest uppercase text-[var(--color-text)]">Top Movers</span>
        <span className="px-[6px] py-[1px] border border-[var(--color-border)] rounded text-[var(--color-text-muted)] font-mono">
          {data.windowMinutes}m
        </span>
        <span className="ml-auto text-[var(--color-text-dim)]">
          excl. SPX · SPY · QQQ
        </span>
      </div>
      {/* Two columns */}
      <div className="grid grid-cols-2">
        <LeaderboardColumn side="buyers"  rows={data.buyers}  watchlist={watchlist} onActivate={onActivate} />
        <LeaderboardColumn side="sellers" rows={data.sellers} watchlist={watchlist} onActivate={onActivate} />
      </div>
    </div>
  )
}
