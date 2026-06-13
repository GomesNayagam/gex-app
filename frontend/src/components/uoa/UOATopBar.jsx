import { RefreshCw, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const WINDOW_OPTIONS = [
  { label: "60m", value: 60 },
  { label: "240m", value: 240 },
  { label: "1d", value: 1440 },
];

const INTENT_OPTIONS = ["all", "bullish", "bearish"];
const STRUCTURE_OPTIONS = ["all", "sweep", "block"];

export default function UOATopBar({
  filters,
  setFilters,
  refresh,
  elapsed,
  REFRESH_INTERVAL,
  paused,
  togglePause,
}) {
  const pct = Math.round((elapsed / REFRESH_INTERVAL) * 100);

  return (
    <div className="glass-strip shrink-0 px-6 py-2.5 flex flex-wrap items-center gap-3 font-mono text-[11px]">
      {/* Window */}
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-3)]">WINDOW</span>
        {WINDOW_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilters({ windowMinutes: value })}
            className={cn(
              "px-2.5 py-[3px] rounded-full transition-colors duration-150",
              filters.windowMinutes === value
                ? "text-[var(--flip)] bg-[rgba(157,184,255,0.10)] shadow-[inset_0_0_0_1px_rgba(157,184,255,0.28)]"
                : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <span className="text-[var(--text-3)]">·</span>

      {/* Min score */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-3)]">SCORE≥</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => setFilters({ minScore: Number(e.target.value) })}
          className="w-20 h-1 accent-[#9db8ff]"
        />
        <span className="text-[var(--text-1)] tabular-nums w-5">
          {filters.minScore}
        </span>
      </div>

      <span className="text-[var(--text-3)]">·</span>

      {/* Intent */}
      <div className="flex items-center gap-0.5">
        {INTENT_OPTIONS.map((v) => {
          const isActive =
            v === "all" ? filters.intent === null : filters.intent === v;
          const activeStyle =
            v === "bullish"
              ? { background: "rgba(110,231,199,0.12)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" }
              : v === "bearish"
                ? { background: "rgba(240,138,155,0.12)", color: "#f08a9b", boxShadow: "inset 0 0 0 1px rgba(240,138,155,0.3)" }
                : { background: "var(--glass-2)", color: "var(--ivory)", boxShadow: "inset 0 0 0 1px var(--edge)" };
          return (
            <button
              key={v}
              onClick={() => setFilters({ intent: v === "all" ? null : v })}
              className="px-1.5 py-0.5 rounded-full transition-colors uppercase tracking-wide"
              style={
                isActive
                  ? activeStyle
                  : { color: "var(--slate-dim)", boxShadow: "inset 0 0 0 1px var(--edge-soft)" }
              }
            >
              {v === "all" ? "ALL" : v === "bullish" ? "▲BULL" : "▼BEAR"}
            </button>
          );
        })}
      </div>

      {/* Structure */}
      <div className="flex items-center gap-0.5">
        {STRUCTURE_OPTIONS.map((v) => {
          const isActive =
            v === "all" ? filters.structure === null : filters.structure === v;
          const activeStyle =
            v === "sweep"
              ? { background: "rgba(157,184,255,0.12)", color: "#9db8ff", boxShadow: "inset 0 0 0 1px rgba(157,184,255,0.3)" }
              : { background: "var(--glass-2)", color: "var(--ivory)", boxShadow: "inset 0 0 0 1px var(--edge)" };
          return (
            <button
              key={v}
              onClick={() => setFilters({ structure: v === "all" ? null : v })}
              className="px-1.5 py-0.5 rounded-full transition-colors uppercase tracking-wide"
              style={
                isActive
                  ? activeStyle
                  : { color: "var(--slate-dim)", boxShadow: "inset 0 0 0 1px var(--edge-soft)" }
              }
            >
              {v.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* 0DTE */}
      <button
        onClick={() =>
          setFilters((f) => ({ zeroDte: !f.zeroDte, expiry: null }))
        }
        className="px-2 py-0.5 rounded-full transition-colors uppercase tracking-wide font-bold"
        style={
          filters.zeroDte
            ? { background: "rgba(201,167,240,0.12)", color: "#c9a7f0", boxShadow: "inset 0 0 0 1px rgba(201,167,240,0.35)" }
            : { color: "var(--slate-dim)", boxShadow: "inset 0 0 0 1px var(--edge-soft)" }
        }
      >
        0DTE
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Progress arc */}
        {!paused && (
          <div className="relative w-5 h-5">
            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="none"
                stroke="var(--edge)"
                strokeWidth="2"
              />
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="none"
                stroke="var(--mint)"
                strokeWidth="2"
                strokeDasharray={`${(50.27 * pct) / 100} 50.27`}
              />
            </svg>
          </div>
        )}
        <button
          onClick={refresh}
          disabled={paused}
          className="flex items-center gap-1 text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={togglePause}
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] px-3.5 py-[5px] rounded-full transition-colors duration-150",
            paused
              ? "text-[var(--gold)] bg-[rgba(232,197,116,0.10)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"
              : "text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)]",
          )}
          title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "resume" : "pause"}
        </button>
      </div>
    </div>
  );
}
