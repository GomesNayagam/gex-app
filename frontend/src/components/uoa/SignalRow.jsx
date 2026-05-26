import { cn } from "@/lib/utils"
import { fmtPremium } from "@/lib/format"
import ScoreBreakdownBar from "./ScoreBreakdownBar"

function scoreColor(score) {
  if (score >= 90) return "text-green-400 border-green-500/60 bg-green-500/10"
  if (score >= 80) return "text-blue-400 border-blue-500/60 bg-blue-500/10"
  if (score >= 60) return "text-amber-400 border-amber-500/60 bg-amber-500/10"
  return "text-[var(--text-3)] border-[var(--border)] bg-transparent"
}

function intentGlyph(intent) {
  if (intent === "bullish") return { glyph: "▲", cls: "text-green-400" }
  if (intent === "bearish") return { glyph: "▼", cls: "text-red-400" }
  return { glyph: "●", cls: "text-[var(--text-3)]" }
}

function aggressorGlyph(agg) {
  const map = { above_ask: "⇧⇧", at_ask: "⇧", mid: "◆", at_bid: "⇩", below_bid: "⇩⇩" }
  return map[agg] || agg
}

const TAG_STYLE = {
  whale: "border border-amber-500 text-amber-400",
  golden: "bg-amber-500 text-black",
  sweep: "bg-blue-600/40 text-blue-300",
  opening: "bg-[var(--surface-3)] text-[var(--text-2)]",
  closing: "bg-[var(--surface-3)] text-[var(--text-2)]",
}

function formatTime(ts) {
  if (!ts) return ""
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/New_York" })
  } catch { return ts.slice(11, 19) }
}

export default function SignalRow({ signal, onClick, isActive }) {
  const { glyph, cls: intentCls } = intentGlyph(signal.intent)
  const scoreCls = scoreColor(signal.score)

  return (
    <div
      onClick={() => onClick(signal)}
      className={cn(
        "border-b border-[var(--border)] px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-3)]",
        isActive && "bg-[var(--surface-3)] border-l-2 border-l-blue-500"
      )}
    >
      <div className="flex items-start gap-3 font-mono text-[11px]">
        {/* Score chip */}
        <div className={cn("flex flex-col items-center justify-center w-10 shrink-0 rounded border px-1 py-1 gap-0.5", scoreCls)}>
          <span className="text-sm font-bold leading-none tabular-nums">{Math.round(signal.score)}</span>
          <span className={cn("text-[8px] leading-none", intentCls)}>{glyph}{signal.intent?.slice(0, 4).toUpperCase()}</span>
        </div>

        {/* Time */}
        <div className="w-16 shrink-0 text-[var(--text-3)] tabular-nums pt-0.5">
          {formatTime(signal.ts)}
        </div>

        {/* Contract */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 text-[var(--text-1)]">
            <span className="font-semibold">{signal.strike?.toLocaleString()} {signal.right}</span>
            <span className="text-[var(--text-2)]">{signal.expiry?.slice(5)} {signal.dte}d</span>
          </div>
          <div className="text-[var(--text-2)] mt-0.5">
            ${signal.price?.toFixed(2)} × {signal.size?.toLocaleString()} = <span className="text-[var(--text-1)]">{fmtPremium(signal.premium)}</span>
          </div>
        </div>

        {/* Flow */}
        <div className="w-32 shrink-0">
          <div className="flex items-center gap-1 text-[var(--text-1)]">
            <span className={cn("uppercase font-semibold", signal.structure === "sweep" ? "text-blue-400" : "text-[var(--text-2)]")}>{signal.structure}</span>
            <span className={intentCls}>{glyph}</span>
            <span className="text-[var(--text-2)] text-[10px]">{aggressorGlyph(signal.aggressor)}</span>
          </div>
          <div className="text-[var(--text-2)] mt-0.5">
            {signal.open_close_bias?.toUpperCase()} ●{signal.open_close_confidence?.toFixed(2)}
            {" "}
            <span className={signal.contract_net_oi_delta >= 0 ? "text-green-400" : "text-red-400"}>
              {signal.contract_net_oi_delta >= 0 ? "+" : ""}{Math.round(signal.contract_net_oi_delta)} OI
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="w-24 shrink-0 pt-0.5">
          <ScoreBreakdownBar breakdown={signal.score_breakdown} score={signal.score} />
        </div>
      </div>

      {/* Tags */}
      {signal.tags?.length > 0 && (
        <div className="flex gap-1 mt-1.5 pl-28 flex-wrap">
          {signal.tags.map((tag) => (
            <span key={tag} className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide", TAG_STYLE[tag] || "bg-[var(--surface-3)] text-[var(--text-2)]")}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
