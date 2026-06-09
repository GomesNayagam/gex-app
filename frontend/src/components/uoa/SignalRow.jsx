import { cn } from "@/lib/utils";
import { fmtPremium } from "@/lib/format";
import ScoreBreakdownBar from "./ScoreBreakdownBar";

const SCORE_TIERS = [
  { min: 90, color: "#22c55e" }, // elite — green
  { min: 80, color: "#3b82f6" }, // high  — blue
  { min: 60, color: "#d97706" }, // mid   — amber
  { min: 0, color: "#3d3d50" }, // low   — dim
];

function scoreColor(score) {
  return SCORE_TIERS.find((t) => score >= t.min)?.color ?? "#3d3d50";
}

function intentGlyph(intent) {
  if (intent === "bullish") return { glyph: "▲", cls: "text-[#22c55e]" };
  if (intent === "bearish") return { glyph: "▼", cls: "text-[#f43f5e]" };
  return { glyph: "●", cls: "text-[var(--text-3)]" };
}

function aggressorGlyph(agg) {
  const map = {
    above_ask: "⇧⇧",
    at_ask: "⇧",
    mid: "◆",
    at_bid: "⇩",
    below_bid: "⇩⇩",
  };
  return map[agg] || agg;
}

const TAG_STYLE = {
  whale: { border: "1px solid #d4a017", color: "#d4a017" },
  golden: { background: "#f59e0b", color: "#000" },
  sweep: { border: "1px solid #3b82f6", color: "#3b82f6" },
  block: { border: "1px solid #4b5563", color: "#6b7280" },
  opening: { border: "1px solid #2d4a2d", color: "#4ade80" },
  closing: { border: "1px solid #4a2d2d", color: "#f87171" },
};

function formatTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/New_York",
    });
  } catch {
    return ts.slice(11, 19);
  }
}

export default function SignalRow({ signal, onClick, isActive }) {
  const { glyph, cls: intentCls } = intentGlyph(signal.intent);
  const scoreClr = scoreColor(signal.score);

  return (
    <div
      onClick={() => onClick(signal)}
      className={cn(
        "border-b border-[var(--border)] px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-3)]",
        isActive && "bg-[var(--surface-3)] border-l-2 border-l-blue-500",
      )}
    >
      <div className="flex items-start gap-3 font-mono text-[11px]">
        {/* Score chip */}
        <div className="flex flex-col items-center justify-center w-10 shrink-0 px-1 py-1 gap-0.5">
          <span className="text-sm font-bold leading-none tabular-nums flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0 inline-block"
              style={{ background: scoreClr }}
            />
            <span style={{ color: scoreClr }}>{Math.round(signal.score)}</span>
          </span>
          <span className={cn("text-[8px] leading-none font-bold", intentCls)}>
            {glyph}
            {signal.intent?.slice(0, 4).toUpperCase()}
          </span>
        </div>

        {/* Time */}
        <div className="w-16 shrink-0 text-[var(--text-3)] tabular-nums pt-0.5">
          {formatTime(signal.ts)}
        </div>

        {/* Contract */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 text-[var(--text-1)]">
            <span className="font-semibold">
              {signal.strike?.toLocaleString()} {signal.right}
            </span>
            <span className="text-[var(--text-2)]">
              {signal.expiry?.slice(5)} {signal.dte}d
            </span>
          </div>
          <div className="text-[var(--text-2)] mt-0.5">
            ${signal.price?.toFixed(2)} × {signal.size?.toLocaleString()} ={" "}
            <span className="text-[var(--text-1)]">
              {fmtPremium(signal.premium)}
            </span>
          </div>
        </div>

        {/* Flow */}
        <div className="w-32 shrink-0">
          <div className="flex items-center gap-1 text-[var(--text-1)]">
            <span
              className={cn(
                "uppercase font-semibold",
                signal.structure === "sweep"
                  ? "text-blue-400"
                  : "text-[var(--text-2)]",
              )}
            >
              {signal.structure}
            </span>
            <span className={intentCls}>{glyph}</span>
            <span className="text-[var(--text-2)] text-[10px]">
              {aggressorGlyph(signal.aggressor)}
            </span>
          </div>
          {/* <div className="text-[var(--text-2)] mt-0.5 flex items-center gap-1">
            <span style={{ color: signal.open_close_bias === "opening_bias" ? "#22c55e" : "#f43f5e" }} className="font-bold">
              {signal.open_close_bias === "opening_bias" ? "Open" :"Close"}
            </span>
            <span>{signal.open_close_confidence?.toFixed(2)}</span>
            <span style={{ color: (signal.contract_net_oi_delta ?? 0) >= 0 ? "#22c55e" : "#f43f5e" }}>
              {(signal.contract_net_oi_delta ?? 0) >= 0 ? "+" : ""}{Math.round(signal.contract_net_oi_delta ?? 0)} OI
            </span>
          </div> */}
        </div>

        {/* Breakdown */}
        <div className="w-24 shrink-0 pt-0.5">
          <ScoreBreakdownBar
            breakdown={signal.score_breakdown}
            score={signal.score}
          />
        </div>
      </div>

      {/* Tags */}
      {signal.tags?.length > 0 && (
        <div className="flex gap-1 mt-1.5 pl-28 flex-wrap">
          {signal.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-wide"
              style={
                TAG_STYLE[tag] || {
                  border: "1px solid #374151",
                  color: "#6b7280",
                }
              }
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
