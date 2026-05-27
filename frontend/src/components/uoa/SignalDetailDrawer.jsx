import { useState, useEffect } from "react";
import { X, Dock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { fmtPremium } from "@/lib/format";
import ScoreBreakdownBar from "./ScoreBreakdownBar";

const LS_PINNED = "uoa-drawer-pinned";

const BREAKDOWN_SEGMENTS = [
  { key: "premium", label: "premium", color: "#3b82f6" },
  { key: "size_vs_oi", label: "size/OI", color: "#22c55e" },
  { key: "aggressor", label: "aggressor", color: "#f59e0b" },
  { key: "sweep", label: "sweep", color: "#a78bfa" },
  { key: "opening_bias", label: "open bias", color: "#34d399" },
  { key: "tenor", label: "tenor", color: "#94a3b8" },
];

const TAG_STYLE = {
  whale: { border: "1px solid #d4a017", color: "#d4a017" },
  golden: { background: "#f59e0b", color: "#000" },
  sweep: { border: "1px solid #3b82f6", color: "#3b82f6" },
  block: { border: "1px solid #4b5563", color: "#6b7280" },
  opening: { border: "1px solid #2d4a2d", color: "#4ade80" },
  closing: { border: "1px solid #4a2d2d", color: "#f87171" },
};

const SCORE_COLORS = [
  { min: 90, color: "#22c55e" },
  { min: 80, color: "#3b82f6" },
  { min: 60, color: "#d97706" },
  { min: 0, color: "#3d3d50" },
];
function scoreColor(s) {
  return SCORE_COLORS.find((t) => s >= t.min)?.color ?? "#3d3d50";
}

const CONVICTION_STYLE = {
  high: { background: "#14532d", color: "#22c55e" },
  medium: { background: "#1e3a5f", color: "#3b82f6" },
  low: { background: "#2d2d10", color: "#d97706" },
};

function Row({ label, value, cls }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-[var(--text-3)] font-mono">{label}</span>
      <span className={cn("text-[var(--text-1)] font-mono tabular-nums", cls)}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function SignalDetailDrawer({ signal, symbol, onClose, chain }) {
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(LS_PINNED) === "true";
    } catch {
      return false;
    }
  });
  const [showJson, setShowJson] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem(LS_PINNED, String(pinned));
    } catch {}
  }, [pinned]);

  if (!signal) return null;

  const bd = signal.score_breakdown || {};
  const en = signal.enrichment || {};
  const ch = chain || {};

  const drawerCls = cn(
    "flex flex-col bg-[var(--surface-1)] border-l border-[var(--border)] overflow-y-auto font-mono text-[11px]",
    pinned
      ? "w-96 shrink-0"
      : "fixed right-0 top-0 bottom-0 w-96 z-50 shadow-2xl",
  );

  const overlay = !pinned ? (
    <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
  ) : null;

  const relativeToSpot = (strike) => {
    const spot = ch.gamma_flip || signal.strike;
    const diff = signal.strike - spot;
    if (Math.abs(diff) < 1) return "at γflip";
    return diff > 0
      ? `+${diff.toFixed(0)} above γflip`
      : `${diff.toFixed(0)} below γflip`;
  };

  return (
    <>
      {overlay}
      <div className={drawerCls}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[var(--text-1)] font-semibold font-mono">
              {signal.strike?.toLocaleString()} {signal.right}{" "}
              {signal.expiry?.slice(5)} ({signal.dte}d)
            </span>
            <button
              onClick={() => {
                const sym = symbol;
                const expiry = signal.expiry;
                if (!sym || !expiry) return;
                try {
                  const saved = localStorage.getItem("expiry-panels");
                  const panels = saved ? JSON.parse(saved) : [];
                  const exists = panels.find(
                    (p) => p.symbol === sym && p.date === expiry,
                  );
                  if (!exists) {
                    panels.push({
                      id: `${sym}-${expiry}-${Date.now()}`,
                      symbol: sym,
                      date: expiry,
                      pinned: false,
                    });
                    localStorage.setItem(
                      "expiry-panels",
                      JSON.stringify(panels),
                    );
                  }
                } catch {}
                navigate("/expiry");
              }}
              className="text-left text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              View {symbol} {signal.expiry} in GEX ladder →
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setPinned((p) => !p)}
              className={cn(
                "p-1 rounded-sm transition-colors",
                pinned
                  ? "text-blue-400"
                  : "text-[var(--text-2)] hover:text-[var(--text-1)]",
              )}
              title={pinned ? "Unpin drawer" : "Pin alongside tape"}
            >
              <Dock size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-[var(--text-2)] hover:text-[var(--text-1)] rounded-sm"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Score */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: scoreColor(signal.score) }}
                />
                <span className="text-[var(--text-2)] uppercase tracking-wider text-[10px]">
                  Score
                </span>
              </div>
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: scoreColor(signal.score) }}
              >
                {Math.round(signal.score)}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--text-3)] uppercase tracking-wider text-[10px]">
                Conviction
              </span>
              <span
                className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide"
                style={
                  CONVICTION_STYLE[signal.conviction] || CONVICTION_STYLE.low
                }
              >
                {signal.conviction}
              </span>
            </div>
            <ScoreBreakdownBar breakdown={bd} score={signal.score} />
            <div className="mt-2 flex flex-col gap-1">
              {BREAKDOWN_SEGMENTS.map(({ key, label, color }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[var(--text-3)] w-20">{label}</span>
                  <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${((bd[key] || 0) / (signal.score || 1)) * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <span className="text-[var(--text-2)] tabular-nums w-6 text-right">
                    {Math.round(bd[key] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Greeks / Enrichment */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">
              Greeks
            </div>
            <div className="flex flex-col gap-1">
              <Row
                label="IV"
                value={en.iv != null ? (en.iv * 100).toFixed(1) + "%" : null}
              />
              <Row label="Delta" value={en.delta?.toFixed(3)} />
              <Row label="Gamma" value={en.gamma?.toFixed(4)} />
              <Row
                label="IV vs ATM"
                value={
                  en.iv_vs_atm != null
                    ? (en.iv_vs_atm >= 0 ? "+" : "") +
                      en.iv_vs_atm?.toFixed(1) +
                      " vol"
                    : null
                }
              />
              <Row label="Moneyness" value={en.moneyness} />
            </div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2 mt-3">
              Notional
            </div>
            <div className="flex flex-col gap-1">
              <Row
                label="δ-notional"
                value={
                  en.estimated_delta_notional != null
                    ? fmtPremium(en.estimated_delta_notional)
                    : null
                }
              />
              <Row
                label="GEX impact (open)"
                value={
                  en.hypothetical_gex_impact_if_opening != null
                    ? fmtPremium(en.hypothetical_gex_impact_if_opening) + " γ$"
                    : null
                }
              />
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Chain context */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">
              Chain Context
            </div>
            <div className="flex flex-col gap-1">
              <Row
                label="Call wall"
                value={ch.call_wall?.toLocaleString()}
                cls={signal.strike === ch.call_wall ? "text-amber-400" : ""}
              />
              <Row
                label="Put wall"
                value={ch.put_wall?.toLocaleString()}
                cls={signal.strike === ch.put_wall ? "text-amber-400" : ""}
              />
              <Row label="γ flip" value={ch.gamma_flip?.toLocaleString()} />
              <Row label="Max pain" value={ch.max_pain?.toLocaleString()} />
            </div>
          </div>

          <hr className="border-[var(--border)]" />

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
  );
}
