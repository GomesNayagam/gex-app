import { useState, useEffect, useRef, useCallback } from "react";
import { X, Dock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { fmtPremium } from "@/lib/format";
import ScoreBreakdownBar from "./ScoreBreakdownBar";
import { fetchFlowSummary } from "@/api";
import { scoreColor, SEGMENT_COLORS } from "@/lib/palette";

const LS_PINNED = "uoa-drawer-pinned";
const LS_WIDTH = "uoa-drawer-width";
const MIN_WIDTH = 280;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 384; // matches the previous w-96

const BREAKDOWN_SEGMENTS = [
  { key: "premium", label: "premium", color: SEGMENT_COLORS.premium },
  { key: "size_vs_oi", label: "size/OI", color: SEGMENT_COLORS.size_vs_oi },
  { key: "aggressor", label: "aggressor", color: SEGMENT_COLORS.aggressor },
  { key: "sweep", label: "sweep", color: SEGMENT_COLORS.sweep },
  { key: "opening_bias", label: "open bias", color: SEGMENT_COLORS.opening_bias },
  { key: "tenor", label: "tenor", color: SEGMENT_COLORS.tenor },
];

const TAG_STYLE = {
  whale:   { boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.45)", color: "#e8c574" },
  golden:  { background: "#e8c574", color: "#0a0e1c", fontWeight: 600 },
  sweep:   { boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.35)", color: "#9db8ff" },
  block:   { boxShadow: "inset 0 0 0 1px var(--edge)", color: "var(--slate-dim)" },
  opening: { boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)", color: "#6ee7c7" },
  closing: { boxShadow: "inset 0 0 0 1px rgba(240,138,155,0.3)", color: "#f08a9b" },
};

const CONVICTION_STYLE = {
  high:   { background: "rgba(110,231,199,0.12)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" },
  medium: { background: "rgba(157,184,255,0.12)", color: "#9db8ff", boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.3)" },
  low:    { background: "rgba(232,197,116,0.12)", color: "#e8c574", boxShadow: "inset 0 0 0 1px rgba(232,197,116,0.35)" },
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

export default function SignalDetailDrawer({ signal, symbol, onClose, chain, windowMinutes = 240 }) {
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(LS_PINNED) === "true";
    } catch {
      return false;
    }
  });
  const [showJson, setShowJson] = useState(false);
  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(LS_WIDTH), 10);
      return Number.isFinite(saved)
        ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, saved))
        : DEFAULT_WIDTH;
    } catch {
      return DEFAULT_WIDTH;
    }
  });
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    if (!signal?.expiry || !symbol) return;
    let cancelled = false;
    setSummary(null);
    setSummaryError(false);
    setSummaryLoading(true);
    fetchFlowSummary(symbol, { windowMinutes, expiry: signal.expiry })
      .then((data) => { if (!cancelled) { setSummary(data); setSummaryLoading(false); } })
      .catch(() => { if (!cancelled) { setSummaryLoading(false); setSummaryError(true); } });
    return () => { cancelled = true; };
  }, [symbol, signal?.expiry, windowMinutes]);

  const navigate = useNavigate();
  const dragState = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PINNED, String(pinned));
    } catch {}
  }, [pinned]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_WIDTH, String(width));
    } catch {}
  }, [width]);

  const onResizeMove = useCallback((e) => {
    const { startX, startWidth } = dragState.current;
    // Drawer is anchored right, so dragging the left edge leftward widens it.
    const next = startWidth + (startX - e.clientX);
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
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
      dragState.current = { startX: e.clientX, startWidth: width };
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
    },
    [width, onResizeMove, onResizeEnd],
  );

  useEffect(() => () => onResizeEnd(), [onResizeEnd]);

  if (!signal) return null;

  const bd = signal.score_breakdown || {};
  const en = signal.enrichment || {};
  const ch = chain || {};

  const drawerCls = cn(
    "relative flex flex-col overflow-y-auto font-mono text-[11px] border-l border-[var(--edge)]",
    "bg-[rgba(21,32,58,0.55)] backdrop-blur-[20px] shadow-[-16px_0_48px_rgba(0,0,0,0.5)]",
    pinned ? "shrink-0" : "fixed right-0 top-0 bottom-0 z-50",
  );

  const overlay = !pinned ? (
    <div className="fixed inset-0 z-40 bg-[rgba(7,10,20,0.5)] backdrop-blur-[2px]" onClick={onClose} />
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
      <div className={drawerCls} style={{ width }}>
        {/* Left-edge horizontal resize handle */}
        <div
          onMouseDown={onResizeStart}
          title="Drag to resize"
          className="group absolute left-0 top-0 bottom-0 z-10 flex w-1.5 cursor-ew-resize items-center justify-center hover:bg-[var(--mint)]"
        >
          <span className="h-6 w-0.5 rounded bg-[var(--text-3)] opacity-60 group-hover:opacity-0" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--edge-soft)] shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-display text-[16px] text-[var(--ivory)]">
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
              className="text-left text-[10px] text-[var(--flip)] hover:text-[var(--ivory)] transition-colors"
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
                  ? "text-[var(--mint)]"
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
          {/* Expiry Summary */}
          {(summaryLoading || summary || summaryError) && (
            <div>
              <span className="text-[var(--text-3)] uppercase tracking-wider text-[10px] block mb-2">
                Expiry Flow Summary
              </span>
              {summaryLoading ? (
                <div className="flex flex-col gap-1">
                  <div className="h-3 w-3/4 rounded bg-[var(--glass-2)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--glass-2)] animate-pulse" />
                </div>
              ) : summaryError ? (
                <span className="text-[10px] text-[var(--text-3)]">failed to load</span>
              ) : summary ? (
                <div className="flex flex-col gap-1">
                  <Row label="signals" value={summary.signal_count != null ? summary.signal_count : "—"} />
                  <Row label="bull premium" value={summary.bullish_premium != null ? `$${(summary.bullish_premium / 1e6).toFixed(1)}M` : null} cls="text-[var(--mint)]" />
                  <Row label="bear premium" value={summary.bearish_premium != null ? `$${(summary.bearish_premium / 1e6).toFixed(1)}M` : null} cls="text-[var(--rose)]" />
                  {summary.net_premium != null && (
                    <Row
                      label="net premium"
                      value={`$${(summary.net_premium / 1e6).toFixed(1)}M`}
                      cls={summary.net_premium >= 0 ? "text-[var(--mint)]" : "text-[var(--rose)]"}
                    />
                  )}
                </div>
              ) : null}
            </div>
          )}
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
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
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

          <hr className="border-[var(--edge-soft)]" />

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

          <hr className="border-[var(--edge-soft)]" />

          {/* Chain context */}
          <div>
            <div className="text-[var(--text-3)] uppercase tracking-wider text-[10px] mb-2">
              Chain Context
            </div>
            <div className="flex flex-col gap-1">
              <Row
                label="Call wall"
                value={ch.call_wall?.toLocaleString()}
                cls={signal.strike === ch.call_wall ? "text-[var(--gold)]" : ""}
              />
              <Row
                label="Put wall"
                value={ch.put_wall?.toLocaleString()}
                cls={signal.strike === ch.put_wall ? "text-[var(--gold)]" : ""}
              />
              <Row label="γ flip" value={ch.gamma_flip?.toLocaleString()} />
              <Row label="Max pain" value={ch.max_pain?.toLocaleString()} />
            </div>
          </div>

          <hr className="border-[var(--edge-soft)]" />

          {/* Raw JSON toggle */}
          <div>
            <button
              onClick={() => setShowJson((v) => !v)}
              className="text-[var(--text-3)] hover:text-[var(--text-2)] text-[10px]"
            >
              {showJson ? "▲ Hide raw JSON" : "▾ Show raw JSON"}
            </button>
            {showJson && (
              <pre className="mt-2 text-[9px] text-[var(--text-2)] bg-[var(--glass)] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(signal, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
