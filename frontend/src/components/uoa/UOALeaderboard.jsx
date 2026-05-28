import { useState, useRef } from "react"
import UOALeaderboardRow from "./UOALeaderboardRow"

function LeaderboardColumn({ side, rows, watchlist, onActivate }) {
  const isBull = side === "buyers"
  const maxNotional = rows.length > 0 ? Math.abs(rows[0].netNotional ?? 0) : 1
  const label = isBull ? "▲ BUYERS" : "▼ SELLERS"

  return (
    <div className={`flex flex-col ${!isBull ? "border-l border-[var(--border)]" : ""}`}>
      <div className="flex items-center px-3 py-[3px] bg-[var(--surface-1)] border-b border-[var(--border)]">
        <span className={`text-[9px] font-bold tracking-widest ${isBull ? "text-green-400" : "text-red-400"}`}>
          {label}
        </span>
        <span className="ml-auto text-[9px] text-[var(--text-3)] tracking-wider">NET $ · MAG · B/S · AGO</span>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-[var(--text-3)] font-mono text-center">No data</div>
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

function ExcludeChip({ symbol, onRemove }) {
  return (
    <span className="flex items-center gap-[3px] px-[5px] py-[1px] bg-[var(--surface-2)] border border-[var(--border)] rounded-sm font-mono text-[9px] text-[var(--text-2)]">
      {symbol}
      <button
        onClick={() => onRemove(symbol)}
        className="text-[var(--text-3)] hover:text-red-400 transition-colors leading-none"
        title={`Un-exclude ${symbol}`}
      >
        ×
      </button>
    </span>
  )
}

function ExcludeInput({ onAdd }) {
  const [val, setVal] = useState("")
  const inputRef = useRef(null)

  const commit = () => {
    const sym = val.trim().toUpperCase()
    if (sym) { onAdd(sym); setVal("") }
  }

  return (
    <span className="flex items-center gap-[2px]">
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setVal("") }}
        placeholder="EXCL…"
        maxLength={6}
        className="w-[44px] bg-transparent border border-[var(--border)] rounded-sm px-[4px] py-[1px] font-mono text-[9px] text-[var(--text-1)] placeholder:text-[var(--text-3)] outline-none focus:border-blue-500"
      />
      {val && (
        <button
          onClick={commit}
          className="text-[9px] text-blue-400 hover:text-blue-300 font-mono px-[3px]"
        >
          +
        </button>
      )}
    </span>
  )
}

export default function UOALeaderboard({
  data, loading, error, watchlist, onActivate,
  excludeList, onAddExclude, onRemoveExclude,
}) {
  if (loading && !data) {
    return (
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-1.5 text-[11px] text-[var(--text-3)] font-mono">
        Loading top movers…
      </div>
    )
  }

  if (error) {
    return (
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 py-1.5 text-[11px] text-red-400 font-mono">
        Top movers unavailable
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-1)]">
      {/* Title bar with exclude chips */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-[3px] px-3 py-[4px] bg-[var(--surface-1)] border-b border-[var(--border)] font-mono text-[9px]">
        <span className="font-bold tracking-widest uppercase text-[var(--text-2)]">Top Movers</span>
        <span className="px-[5px] py-[1px] border border-[var(--border)] rounded-sm text-[var(--text-3)]">
          {data.windowMinutes}m
        </span>

        <span className="text-[var(--text-3)]">excl.</span>
        {(excludeList || []).map((sym) => (
          <ExcludeChip key={sym} symbol={sym} onRemove={onRemoveExclude} />
        ))}
        <ExcludeInput onAdd={onAddExclude} />
      </div>

      <div className="grid grid-cols-2">
        <LeaderboardColumn side="buyers"  rows={data.buyers}  watchlist={watchlist} onActivate={onActivate} />
        <LeaderboardColumn side="sellers" rows={data.sellers} watchlist={watchlist} onActivate={onActivate} />
      </div>
    </div>
  )
}
