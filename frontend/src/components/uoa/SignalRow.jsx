import { cn } from "@/lib/utils";
import { fmtPremium } from "@/lib/format";
import ScoreBreakdownBar from "./ScoreBreakdownBar";
import { scoreColor } from "@/lib/palette";

function intentGlyph(intent) {
  if (intent === "bullish") return { glyph: "▲", cls: "text-[var(--mint)]" };
  if (intent === "bearish") return { glyph: "▼", cls: "text-[var(--rose)]" };
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
  whale:   { boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.45)", color: "#e8c574" },
  golden:  { background: "#e8c574", color: "#0a0e1c", fontWeight: 600 },
  sweep:   { boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.35)", color: "#9db8ff" },
  block:   { boxShadow: "inset 0 0 0 1px var(--edge)", color: "var(--slate-dim)" },
  opening: { boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)", color: "#6ee7c7" },
  closing: { boxShadow: "inset 0 0 0 1px rgba(240,138,155,0.3)", color: "#f08a9b" },
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
        "border-b border-[var(--edge-soft)] px-6 py-2 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)]",
        isActive && "bg-[var(--glass-2)] border-l-2 border-l-[var(--mint)]",
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
                  ? "text-[var(--flip)]"
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
              className="px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wide"
              style={
                TAG_STYLE[tag] || {
                  boxShadow: "inset 0 0 0 1px var(--edge)",
                  color: "var(--slate-dim)",
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
