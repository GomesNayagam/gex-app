import { useState, useRef, useEffect, useCallback } from "react"
import UOALeaderboardRow from "./UOALeaderboardRow"

const HEIGHT_KEY = "uoa.leaderboard.height"
const MIN_HEIGHT = 120
const MAX_HEIGHT = 600
const DEFAULT_HEIGHT = 260

function LeaderboardColumn({ side, rows, watchlist, onActivate }) {
  const isBull = side === "buyers"
  const label = isBull ? "▲ BUYERS" : "▼ SELLERS"

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderLeft: isBull ? "none" : "1px solid var(--border)",
    }}>
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "3px 12px",
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        fontFamily: "inherit",
        fontSize: 9,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>
        <span style={{ fontWeight: 700, color: isBull ? "var(--green)" : "var(--red)" }}>{label}</span>
        <span style={{ marginLeft: "auto", color: "var(--text-3)", letterSpacing: "0.06em" }}>NET $ · B/S · AGO</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-3)", textAlign: "center", fontFamily: "inherit" }}>
          No data
        </div>
      ) : (
        rows.map((entry, i) => (
          <UOALeaderboardRow
            key={entry.symbol}
            rank={i + 1}
            entry={entry}
            side={side}
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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 5px",
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: 2,
      fontSize: 9, fontFamily: "inherit",
      color: "var(--text-2)",
    }}>
      {symbol}
      <button
        onClick={() => onRemove(symbol)}
        style={{ color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0, fontSize: 11 }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--red)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-3)"}
        title={`Un-exclude ${symbol}`}
      >×</button>
    </span>
  )
}

function ExcludeInput({ onAdd }) {
  const [val, setVal] = useState("")

  const commit = () => {
    const sym = val.trim().toUpperCase()
    if (sym) { onAdd(sym); setVal("") }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setVal("") }}
        placeholder="EXCL…"
        maxLength={6}
        style={{
          width: 44, background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 2, padding: "1px 4px",
          fontFamily: "inherit", fontSize: 9,
          color: "var(--text-1)",
          outline: "none",
        }}
        onFocus={(e) => e.target.style.borderColor = "var(--blue)"}
        onBlur={(e) => e.target.style.borderColor = "var(--border)"}
      />
      {val && (
        <button
          onClick={commit}
          style={{ fontSize: 9, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: "0 3px", fontFamily: "inherit" }}
        >+</button>
      )}
    </span>
  )
}

export default function UOALeaderboard({
  data, loading, error, watchlist, onActivate,
  excludeList, onAddExclude, onRemoveExclude,
}) {
  const [height, setHeight] = useState(() => {
    const saved = parseInt(localStorage.getItem(HEIGHT_KEY), 10)
    return Number.isFinite(saved) ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, saved)) : DEFAULT_HEIGHT
  })
  const containerRef = useRef(null)
  const dragState = useRef(null)

  useEffect(() => {
    localStorage.setItem(HEIGHT_KEY, String(height))
  }, [height])

  const onResizeMove = useCallback((e) => {
    const { startY, startHeight } = dragState.current
    const next = startHeight + (e.clientY - startY)
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)))
  }, [])

  const onResizeEnd = useCallback(() => {
    dragState.current = null
    document.removeEventListener("mousemove", onResizeMove)
    document.removeEventListener("mouseup", onResizeEnd)
    document.body.style.userSelect = ""
    document.body.style.cursor = ""
  }, [onResizeMove])

  const onResizeStart = useCallback((e) => {
    e.preventDefault()
    dragState.current = {
      startY: e.clientY,
      startHeight: containerRef.current?.offsetHeight ?? height,
    }
    document.addEventListener("mousemove", onResizeMove)
    document.addEventListener("mouseup", onResizeEnd)
    document.body.style.userSelect = "none"
    document.body.style.cursor = "ns-resize"
  }, [height, onResizeMove, onResizeEnd])

  useEffect(() => () => onResizeEnd(), [onResizeEnd])

  const baseStyle = {
    flexShrink: 0,
    borderBottom: "1px solid var(--border)",
    background: "var(--surface-1)",
    fontFamily: "'IBM Plex Mono', monospace",
  }

  if (loading && !data) {
    return (
      <div style={{ ...baseStyle, padding: "6px 16px", fontSize: 11, color: "var(--text-3)" }}>
        Loading top movers…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...baseStyle, padding: "6px 16px", fontSize: 11, color: "var(--red)" }}>
        Top movers unavailable
      </div>
    )
  }

  if (!data) return null

  return (
    <div
      ref={containerRef}
      style={{
        ...baseStyle,
        height,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Title bar */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", flexWrap: "wrap",
        gap: "6px 8px", padding: "4px 12px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        fontSize: 9, fontFamily: "inherit",
      }}>
        <span style={{ fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--text-1)" }}>
          Top Movers
        </span>
        <span style={{
          padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 2,
          color: "var(--text-3)", fontFamily: "inherit",
        }}>
          {data.windowMinutes}m
        </span>
        <span style={{ color: "var(--text-3)" }}>excl.</span>
        {(excludeList || []).map((sym) => (
          <ExcludeChip key={sym} symbol={sym} onRemove={onRemoveExclude} />
        ))}
        <ExcludeInput onAdd={onAddExclude} />
      </div>

      {/* Two columns (scrollable) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <LeaderboardColumn side="buyers"  rows={data.buyers}  watchlist={watchlist} onActivate={onActivate} />
        <LeaderboardColumn side="sellers" rows={data.sellers} watchlist={watchlist} onActivate={onActivate} />
      </div>

      {/* Vertical resize handle */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        style={{
          flexShrink: 0,
          height: 6,
          cursor: "ns-resize",
          background: "var(--surface-2)",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--blue)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-2)"}
      >
        <span style={{ width: 24, height: 2, borderRadius: 2, background: "var(--text-3)", opacity: 0.6 }} />
      </div>
    </div>
  )
}
