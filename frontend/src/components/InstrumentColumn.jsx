import { Fragment, useState, useEffect, useRef } from "react";
import StatCard, { StatChip, StatBar } from "./StatCard";
import StrikeRow from "./StrikeRow";
import { Badge } from "@/components/ui/badge";
import { fmtGex, fmtSpot, fmtStrike } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchDealerRisk } from "@/api";

export default function InstrumentColumn({ inst, compact = false }) {
  const { symbol, spot, flip, net_gex, regime, strikes } = inst;

  const isPos = spot >= flip;

  const aboveSpot = strikes.filter((s) => s.strike > spot);
  const belowSpot = strikes.filter((s) => s.strike < spot);

  const callWallS = (aboveSpot.length ? aboveSpot : strikes).reduce((a, b) =>
    b.call_gex > a.call_gex ? b : a,
  );
  const putWallS = (belowSpot.length ? belowSpot : strikes).reduce((a, b) =>
    Math.abs(b.put_gex) > Math.abs(a.put_gex) ? b : a,
  );
  const pinS = strikes.reduce((a, b) =>
    Math.abs(b.net_gex) > Math.abs(a.net_gex) ? b : a,
  );

  const maxNet = Math.max(...strikes.map((s) => Math.abs(s.net_gex)));
  const maxCall = Math.max(...strikes.map((s) => s.call_gex));
  const maxPut = Math.max(...strikes.map((s) => Math.abs(s.put_gex)));

  const [dealerRisk, setDealerRisk] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchDealerRisk(symbol);
        if (!cancelled) setDealerRisk(data);
      } catch {
        // silently skip — card stays hidden
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [symbol]);

  const spotRef = useRef(null);

  useEffect(() => {
    if (spotRef.current) {
      spotRef.current.scrollIntoView({ block: "center" });
    }
  }, [inst]);

  const [netGexSort, setNetGexSort] = useState(null); // null | "asc" | "desc"

  const sortedStrikes = [...strikes].sort((a, b) => {
    if (netGexSort === "asc") return a.net_gex - b.net_gex;
    if (netGexSort === "desc") return b.net_gex - a.net_gex;
    return b.strike - a.strike;
  });

  function cycleNetGexSort() {
    setNetGexSort((s) => (s === null ? "desc" : s === "desc" ? "asc" : null));
  }

  return (
    <div className={cn("flex flex-col animate-[fadeIn_0.35s_ease_both]", compact ? "gap-2" : "gap-3")}>
      {/* Stat chips — single row, 5 columns when dealer risk available */}
      <div className={cn("grid gap-1.5", dealerRisk ? "grid-cols-5" : "grid-cols-4")}>
        <StatChip
          type="call"
          label="Call Wall"
          value={fmtStrike(symbol, callWallS.strike)}
          sub1={fmtGex(callWallS.call_gex)}
          sub2="Resistance"
        />
        <StatChip
          type="flip"
          label="γ Flip"
          value={fmtStrike(symbol, flip)}
          sub1={isPos ? '<span style="color:var(--green)">+GEX above</span>' : '<span style="color:var(--red)">−GEX below</span>'}
          sub2="Zero gamma"
        />
        <StatChip
          type="put"
          label="Put Wall"
          value={fmtStrike(symbol, putWallS.strike)}
          sub1={fmtGex(putWallS.put_gex)}
          sub2="Support"
        />
        <StatChip
          type="pin"
          label="Pin Strike"
          value={fmtStrike(symbol, pinS.strike)}
          sub1={fmtGex(pinS.net_gex)}
          sub2="Intraday magnet"
        />
        {dealerRisk && (
          <StatChip
            type="dealer"
            label="Dealer Risk"
            value={dealerRisk.flow_direction.toUpperCase()}
            sub1={`${(dealerRisk.flow_gex_pct_shift * 100).toFixed(1)}% GEX shift`}
            sub2={dealerRisk.description}
          />
        )}
      </div>

      {/* Ladder card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
        {/* Frozen header rows */}
        <div className="flex-none">
          {/* Header */}
          <div className={cn("flex items-center justify-between bg-[var(--surface-2)] border-b border-[var(--border)]", compact ? "px-3 py-1.5" : "px-4 py-2.5")}>
            <div className="flex items-center gap-2">
              <span className={cn("font-mono font-semibold tracking-widest text-text-1", compact ? "text-xs" : "text-sm")}>
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
              {strikes.length} strikes · all expirations
            </span>
            <span className="font-mono text-[8px] text-text-2">
              Net:{" "}
              <span
                className={cn(
                  "font-semibold",
                  isPos ? "text-green" : "text-red",
                )}
              >
                {fmtGex(net_gex)}
              </span>
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[56px_1fr_64px] px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border)]">
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-2">Strike</span>
            <span className="font-mono text-[8px] uppercase tracking-widest text-text-2 text-center">← Put · Net GEX · Call →</span>
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
        <div className={cn("overflow-y-auto", compact ? "max-h-[240px]" : "max-h-[420px]")}>
          {sortedStrikes.map((d) => (
            <Fragment key={d.strike}>
              <StrikeRow
                d={d}
                symbol={symbol}
                maxNet={maxNet}
                maxCall={maxCall}
                maxPut={maxPut}
                compact={compact}
              />
              {d.is_spot && (
                <div ref={spotRef} className="relative h-px z-10 overflow-visible">
                  <div className="absolute inset-0 bg-amber opacity-60" />
                  <div className="absolute right-3 -top-[9px] font-mono text-[8px] text-amber bg-[var(--surface)] border border-amber/50 rounded px-1.5 py-px whitespace-nowrap tracking-wide">
                    SPOT {fmtSpot(symbol, spot)}
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
