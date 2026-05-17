import { Fragment, useState, useEffect, useRef, useCallback } from "react";
import StrikeRow from "./StrikeRow";
import { Badge } from "@/components/ui/badge";
import { fmtGex, fmtSpot, fmtStrike } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAG_COLOR = {
  call: "#22c55e",
  flip: "#3b82f6",
  put: "#ef4444",
};

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 700;

export default function InstrumentColumn({
  inst,
  compact = false,
  resizable = false,
}) {
  const {
    symbol,
    spot,
    flip,
    net_gex,
    strikes,
    call_wall,
    put_wall,
    regime,
    flow_direction,
  } = inst;

  const isPos = regime.toLowerCase();

  const callWallStrike = call_wall?.strike;
  const putWallStrike = put_wall?.strike;
  const flipStrike = flip;

  const maxNet = Math.max(...strikes.map((s) => Math.abs(s.net_gex)));
  const maxCall = Math.max(...strikes.map((s) => s.call_gex));
  const maxPut = Math.max(...strikes.map((s) => Math.abs(s.put_gex)));

  const spotRef = useRef(null);

  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.scrollIntoView({ block: "center" });
    }
  }, [inst]);

  const storageKey = `gex:ladder-height:${symbol}`;

  const [ladderHeight, setLadderHeight] = useState(() => {
    if (!resizable) return DEFAULT_HEIGHT;
    const saved = localStorage.getItem(storageKey);
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT
      ? parsed
      : DEFAULT_HEIGHT;
  });

  const ladderHeightRef = useRef(ladderHeight);
  useEffect(() => {
    ladderHeightRef.current = ladderHeight;
  }, [ladderHeight]);

  const dragState = useRef(null);

  const handleDragMouseDown = useCallback(
    (e) => {
      if (!resizable || compact) return;
      e.preventDefault();
      document.body.style.userSelect = "none";
      dragState.current = {
        startY: e.clientY,
        startHeight: ladderHeightRef.current,
      };

      function onMouseMove(ev) {
        const dy = ev.clientY - dragState.current.startY;
        const next = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragState.current.startHeight + dy),
        );
        setLadderHeight(next);
      }

      function onMouseUp(ev) {
        const dy = ev.clientY - dragState.current.startY;
        const next = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragState.current.startHeight + dy),
        );
        localStorage.setItem(storageKey, String(next));
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        dragState.current = null;
      }

      dragState.current._onMouseMove = onMouseMove;
      dragState.current._onMouseUp = onMouseUp;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [resizable, compact, storageKey],
  );

  useEffect(() => {
    return () => {
      if (dragState.current) {
        document.removeEventListener(
          "mousemove",
          dragState.current._onMouseMove,
        );
        document.removeEventListener("mouseup", dragState.current._onMouseUp);
      }
    };
  }, []);

  const [netGexSort, setNetGexSort] = useState(null); // null | "asc" | "desc"

  const sortedStrikes = [...strikes].sort((a, b) => {
    if (netGexSort === "asc") return a.net_gex - b.net_gex;
    if (netGexSort === "desc") return b.net_gex - a.net_gex;
    return b.strike - a.strike;
  });

  function cycleNetGexSort() {
    setNetGexSort((s) => (s === null ? "desc" : s === "desc" ? "asc" : null));
  }

  function tagsForStrike(d) {
    const tags = [];
    if (d.strike === callWallStrike)
      tags.push({ label: "Call Wall", color: TAG_COLOR.call });
    if (d.strike === flipStrike)
      tags.push({ label: "γ Flip", color: TAG_COLOR.flip });
    if (d.strike === putWallStrike)
      tags.push({ label: "Put Wall", color: TAG_COLOR.put });
    return tags;
  }

  return (
    <div
      className={cn(
        "flex flex-col animate-[fadeIn_0.35s_ease_both]",
        compact ? "gap-2" : "gap-3",
      )}
    >
      {/* Ladder card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
        {/* Frozen header rows */}
        <div className="flex-none">
          {/* Header */}
          <div
            className={cn(
              "flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--border)]",
              compact ? "px-3 py-1.5" : "px-4 py-2.5",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-mono font-semibold tracking-widest text-text-1",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {symbol}
              </span>
              <Badge variant={isPos ? "positive" : "negative"}>
                {isPos ? "+GEX" : "−GEX"}
              </Badge>
            </div>
            <Badge variant="amber">{fmtSpot(symbol, spot)}</Badge>
          </div>

          {/* Sub-header */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-2">
              {strikes.length} strikes
            </span>
            <span className="font-mono text-[9px] text-text-2">
              Net:{" "}
              <span
                className={cn(
                  "font-semibold",
                  isPos ? "text-green" : "text-red",
                )}
              >
                {fmtGex(net_gex)}{" "}
              </span>
              <span className="font-semibold uppercase text-[10px] text-pink-600">
                {flow_direction}
              </span>
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[minmax(80px,auto)_1fr_48px] px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-2">
              Strike
            </span>
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-2 text-center">
              ← Put · Net GEX · Call →
            </span>
            <button
              onClick={cycleNetGexSort}
              className="font-mono text-[8px] uppercase tracking-widest text-right flex items-center justify-end gap-0.5 cursor-pointer select-none"
              style={{ color: netGexSort ? "var(--amber)" : "var(--text-2)" }}
              title="Sort by Net GEX"
            >
              Net GEX
              <span className="text-[9px] leading-none">
                {netGexSort === "desc" ? "↓" : netGexSort === "asc" ? "↑" : "⇅"}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable strike rows */}
        <div
          className="overflow-y-auto"
          style={{
            height: compact ? 240 : ladderHeight,
            minHeight: compact ? 240 : MIN_HEIGHT,
          }}
        >
          {sortedStrikes.map((d) => (
            <Fragment key={d.strike}>
              <StrikeRow
                d={d}
                symbol={symbol}
                maxNet={maxNet}
                maxCall={maxCall}
                maxPut={maxPut}
                compact={compact}
                tags={tagsForStrike(d)}
              />
              {d.is_spot && (
                <div
                  ref={spotRef}
                  className="relative h-px z-10 overflow-visible"
                >
                  <div className="absolute inset-0 bg-amber opacity-60" />
                  <div className="absolute right-3 -top-[9px] font-mono text-[8px] text-amber bg-[var(--surface)] border border-amber/50 rounded px-1.5 py-px whitespace-nowrap tracking-wide">
                    SPOT {fmtSpot(symbol, spot)}
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        {/* Drag handle — only shown when resizable and not compact */}
        {resizable && !compact && (
          <div
            onMouseDown={handleDragMouseDown}
            className="flex-none flex items-center justify-center h-3 border-t border-[var(--border)] cursor-ns-resize select-none group"
            style={{ background: "var(--surface-2)" }}
            title="Drag to resize"
          >
            <span
              className="font-mono text-[10px] tracking-widest text-[var(--border)] group-hover:text-[var(--text-3)] transition-colors leading-none"
              style={{ letterSpacing: "0.25em" }}
            >
              ⋯
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
