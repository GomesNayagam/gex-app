import { useState, useEffect } from "react"
import { X, Dock } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { fmtPremium } from "@/lib/format"
import ScoreBreakdownBar from "./ScoreBreakdownBar"

const LS_PINNED = "uoa-drawer-pinned"

const BREAKDOWN_LABELS = {
  premium: "premium",
  size_vs_oi: "size/OI",
  aggressor: "aggressor",
  sweep: "sweep",
  opening_bias: "open bias",
  tenor: "tenor",
}

function Row({ label, value, cls }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-[var(--text-3)] font-mono">{label}</span>
      <span className={cn("text-[var(--text-1)] font-mono tabular-nums", cls)}>{value ?? "—"}</span>
    </div>
  )
}

export default function SignalDetailDrawer({ signal, onClose, chain }) {
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(LS_PINNED) === "true" } catch { return false }
  })
  const [showJson, setShowJson] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    try { localStorage.setItem(LS_PINNED, String(pinned)) } catch {}
  }, [pinned])

  if (!signal) return null

  const bd = signal.score_breakdown || {}
  const en = signal.enrichment || {}
  const ch = chain || {}

  const drawerCls = cn(
    "flex flex-col bg-[var(--surface-1)] border-l border-[var(--border)] overflow-y-auto font-mono text-[11px]",
    pinned ? "w-96 shrink-0" : "fixed right-0 top-0 bottom-0 w-96 z-50 shadow-2xl"
  )

  const overlay = !pinned ? (
    <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
  ) : null

  const relativeToSpot = (strike) => {
    const spot = ch.gamma_flip || signal.strike
    const diff = signal.strike - spot
    if (Math.abs(diff) < 1) return "at γflip"
    return diff > 0 ? `+${diff.toFixed(0)} above γflip` : `${diff.toFixed(0)} below γflip`
  }

  return (
    <>
      {overlay}
      <div className={drawerCls}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="text-[var(--text-1)] font-semibold">
            {signal.strike?.toLocaleString()} {signal.right}  {signal.expiry?.slice(5)} ({signal.dte}d)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPinned((p) => !p)}
              className={cn("p-1 rounded-sm transition-colors", pinned ? "text-blue-400" : "text-[var(--text-2)] hover:text-[var(--text-1)]")}
              title={pinned ? "Unpin drawer" : "Pin alongside tape"}
            >
              <Dock size={13} />
            </button>
            <button onClick={onClose} className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] rounded-sm">
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--text-2)] uppercase tracking-wider text-[10px]">Score</span>
              <span className="text-[var(--text-1)] text-lg font-bold tabular-nums">{Math.round(signal.score)}</span>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[var(--text-3)]">conviction</span>
              <span className="text-[var(--text-1)] uppercase">{signal.conviction}</span>
            </div>
            <ScoreBreakdownBar breakdown={bd} score={signal.score} />
            <div className="mt-2 flex flex-col gap-1">
              {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[var(--text-3)] w-20">{label}</span>
                  <div className="flex-1 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${((bd[key] || 0) / signal.score) * 100}%` }} />
                  </div>
                  <span className="text-[var(--text-2)] tabular-nums w-6 text-right">{Math.round(bd[key] || 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Greeks / Enrichment */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">Greeks</div>
            <div className="flex flex-col gap-1">
              <Row label="IV" value={en.iv != null ? (en.iv * 100).toFixed(1) + "%" : null} />
              <Row label="Delta" value={en.delta?.toFixed(3)} />
              <Row label="Gamma" value={en.gamma?.toFixed(4)} />
              <Row label="IV vs ATM" value={en.iv_vs_atm != null ? (en.iv_vs_atm >= 0 ? "+" : "") + en.iv_vs_atm?.toFixed(1) + " vol" : null} />
              <Row label="Moneyness" value={en.moneyness} />
            </div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2 mt-3">Notional</div>
            <div className="flex flex-col gap-1">
              <Row label="δ-notional" value={en.estimated_delta_notional != null ? fmtPremium(en.estimated_delta_notional) : null} />
              <Row label="GEX impact (open)" value={en.hypothetical_gex_impact_if_opening != null ? fmtPremium(en.hypothetical_gex_impact_if_opening) + " γ$" : null} />
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Chain context */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">Chain Context</div>
            <div className="flex flex-col gap-1">
              <Row label="Call wall" value={ch.call_wall?.toLocaleString()} cls={signal.strike === ch.call_wall ? "text-amber-400" : ""} />
              <Row label="Put wall" value={ch.put_wall?.toLocaleString()} cls={signal.strike === ch.put_wall ? "text-amber-400" : ""} />
              <Row label="γ flip" value={ch.gamma_flip?.toLocaleString()} />
              <Row label="Max pain" value={ch.max_pain?.toLocaleString()} />
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Tags */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">Tags</div>
            <div className="flex flex-wrap gap-1">
              {(signal.tags || []).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-1)] text-[10px] uppercase">{tag}</span>
              ))}
            </div>
          </div>

          {/* Deep link to GEX ladder */}
          <button
            onClick={() => navigate(`/b3?symbol=${signal.strike}&strike=${signal.strike}`)}
            className="text-blue-400 hover:text-blue-300 text-[10px] underline text-left"
          >
            View {signal.strike?.toLocaleString()} in GEX ladder →
          </button>

          {/* Raw JSON toggle */}
          <div>
            <button
              onClick={() => setShowJson((v) => !v)}
              className="text-[var(--text-3)] hover:text-[var(--text-2)] text-[10px]"
            >
              {showJson ? "▲ Hide raw JSON" : "▾ Show raw JSON"}
            </button>
            {showJson && (
              <pre className="mt-2 text-[9px] text-[var(--text-2)] bg-[var(--surface-2)] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(signal, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
