import { useState, useRef, useEffect, useCallback } from "react";
import UOALeaderboardRow from "./UOALeaderboardRow";

const HEIGHT_KEY = "uoa.leaderboard.height";
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 260;

function LeaderboardColumn({ side, rows, watchlist, onActivate }) {
  const isBull = side === "buyers";
  const label = isBull ? "▲ BUYERS" : "▼ SELLERS";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderLeft: isBull ? "none" : "1px solid var(--edge-soft)",
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "3px 12px",
          background: "rgba(255,255,255,0.015)",
          borderBottom: "1px solid var(--edge-soft)",
          fontFamily: "inherit",
          fontSize: 9,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            color: isBull ? "var(--mint)" : "var(--rose)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginLeft: "auto",
            color: "var(--slate-dim)",
            letterSpacing: "0.06em",
          }}
        >
          NET $ · B/S · AGO
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--slate-dim)",
            textAlign: "center",
            fontFamily: "inherit",
          }}
        >
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
  );
}

function ExcludeChip({ symbol, onRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 7px",
        background: "var(--glass)",
        boxShadow: "inset 0 0 0 1px var(--edge-soft)",
        borderRadius: 99,
        fontSize: 9,
        fontFamily: "inherit",
        color: "var(--text-2)",
      }}
    >
      {symbol}
      <button
        onClick={() => onRemove(symbol)}
        style={{
          color: "var(--text-3)",
          background: "none",
          border: "none",
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
          fontSize: 11,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--rose)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
        title={`Un-exclude ${symbol}`}
      >
        ×
      </button>
    </span>
  );
}

function ExcludeInput({ onAdd }) {
  const [val, setVal] = useState("");

  const commit = () => {
    const sym = val.trim().toUpperCase();
    if (sym) {
      onAdd(sym);
      setVal("");
    }
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setVal("");
        }}
        placeholder="EXCL…"
        maxLength={6}
        style={{
          width: 44,
          background: "transparent",
          border: "1px solid var(--edge)",
          borderRadius: 99,
          padding: "1px 7px",
          fontFamily: "inherit",
          fontSize: 9,
          color: "var(--text-1)",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(232,197,116,0.55)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--edge)")}
      />
      {val && (
        <button
          onClick={commit}
          style={{
            fontSize: 9,
            color: "var(--mint)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 3px",
            fontFamily: "inherit",
          }}
        >
          +
        </button>
      )}
    </span>
  );
}

function fmtTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function UOALeaderboard({
  data,
  loading,
  error,
  watchlist,
  onActivate,
  excludeList,
  onAddExclude,
  onRemoveExclude,
  paused,
  lastUpdated,
  onPause,
  onResume,
}) {
  const [height, setHeight] = useState(() => {
    const saved = parseInt(localStorage.getItem(HEIGHT_KEY), 10);
    return Number.isFinite(saved)
      ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, saved))
      : DEFAULT_HEIGHT;
  });
  const containerRef = useRef(null);
  const dragState = useRef(null);

  useEffect(() => {
    localStorage.setItem(HEIGHT_KEY, String(height));
  }, [height]);

  const onResizeMove = useCallback((e) => {
    const { startY, startHeight } = dragState.current;
    const next = startHeight + (e.clientY - startY);
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)));
  }, []);

  const onResizeEnd = useCallback(() => {
    dragState.current = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [onResizeMove]);

  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      dragState.current = {
        startY: e.clientY,
        startHeight: containerRef.current?.offsetHeight ?? height,
      };
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";
    },
    [height, onResizeMove, onResizeEnd],
  );

  useEffect(() => () => onResizeEnd(), [onResizeEnd]);

  const baseStyle = {
    flexShrink: 0,
    borderBottom: "1px solid var(--edge-soft)",
    background: "var(--glass)",
    backdropFilter: "blur(14px)",
    fontFamily: "'JetBrains Mono', monospace",
  };

  if (loading && !data) {
    return (
      <div
        style={{
          ...baseStyle,
          padding: "6px 16px",
          fontSize: 11,
          color: "var(--text-3)",
        }}
      >
        Loading top movers…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          ...baseStyle,
          padding: "6px 16px",
          fontSize: 11,
          color: "var(--red)",
        }}
      >
        Top movers unavailable
      </div>
    );
  }

  if (!data) return null;

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
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px 8px",
          padding: "4px 12px",
          background: "rgba(255,255,255,0.015)",
          borderBottom: "1px solid var(--edge-soft)",
          fontSize: 9,
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 13,
            textTransform: "none",
            letterSpacing: "0.01em",
            color: "var(--ivory)",
          }}
        >
          Top Movers
        </span>
        <span
          style={{
            padding: "1px 7px",
            boxShadow: "inset 0 0 0 1px var(--edge)",
            borderRadius: 99,
            color: "var(--slate-dim)",
            fontFamily: "inherit",
          }}
        >
          {data.windowMinutes}m
        </span>
        <span style={{ color: "var(--text-3)" }}>excl.</span>
        {(excludeList || []).map((sym) => (
          <ExcludeChip key={sym} symbol={sym} onRemove={onRemoveExclude} />
        ))}
        <ExcludeInput onAdd={onAddExclude} />
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {paused && (
            <>
              <span
                style={{
                  padding: "1px 7px",
                  borderRadius: 99,
                  background: "rgba(232,197,116,0.15)",
                  color: "var(--gold)",
                  boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.4)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                PAUSED
              </span>
              {lastUpdated && (
                <span style={{ color: "var(--text-3)", fontSize: 9 }}>
                  {fmtTime(lastUpdated)}
                </span>
              )}
            </>
          )}
          <button
            onClick={paused ? onResume : onPause}
            title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}
            style={{
              background: "none",
              border: "1px solid var(--edge)",
              borderRadius: 99,
              color: paused ? "var(--mint)" : "var(--text-2)",
              cursor: "pointer",
              fontSize: 11,
              lineHeight: 1,
              padding: "1px 8px",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = paused
                ? "var(--mint)"
                : "var(--flip)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--edge)")
            }
          >
            {paused ? "▶ resume" : "⏸ pause"}
          </button>
        </span>
      </div>

      {/* Two columns (scrollable) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        <LeaderboardColumn
          side="buyers"
          rows={data.buyers}
          watchlist={watchlist}
          onActivate={onActivate}
        />
        <LeaderboardColumn
          side="sellers"
          rows={data.sellers}
          watchlist={watchlist}
          onActivate={onActivate}
        />
      </div>

      {/* Vertical resize handle */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize"
        style={{
          flexShrink: 0,
          height: 6,
          cursor: "ns-resize",
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid var(--edge-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.015)")
        }
      >
        <span
          style={{
            width: 24,
            height: 2,
            borderRadius: 2,
            background: "var(--slate-dim)",
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
