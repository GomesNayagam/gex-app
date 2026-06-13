import { useState, useEffect, useRef, useCallback } from "react";
import { Zap, Plus, X, Pin, PinOff, RefreshCw, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { fetchGEXBySymbol } from "@/api";
import { getRefreshInterval } from "@/lib/refreshSettings";
import InstrumentColumn from "@/components/InstrumentColumn";

// ── Single watchlist panel ────────────────────────────────────────────────────
function WatchPanel({ id, symbol, zeroDTE, pinned, onClose, onTogglePin, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGEXBySymbol(symbol, {
          strikes: 50,
          expiry: zeroDTE ? "0dte" : null,
        });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [symbol, zeroDTE, refreshKey]);

  return (
    <div
      className={cn(
        "glass-panel flex flex-col min-w-[320px] flex-shrink-0",
        pinned && "shadow-[inset_0_0_0_1px_rgba(110,231,199,0.3),0_12px_36px_rgba(0,0,0,0.35)]"
      )}
      style={{ width: "360px" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[var(--edge-soft)] flex-none">
        <span className="font-display text-[15px] leading-none text-[var(--ivory)]">{symbol}</span>
        {zeroDTE && <span className="font-mono text-[8px] uppercase tracking-widest px-1.5 py-px rounded-full text-[var(--gold)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]">0DTE</span>}
        {pinned && <span className="font-mono text-[8px] uppercase tracking-widest text-[var(--mint)] ml-0.5">pinned</span>}
        <div className="flex items-center gap-1 ml-auto">
          {loading && <RefreshCw size={10} className="animate-spin text-[var(--text-3)]" />}
          <button
            onClick={() => onTogglePin(id)}
            className={cn(
              "p-0.5 rounded transition-colors",
              pinned ? "text-[var(--mint)]" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            )}
            title={pinned ? "Unpin" : "Pin panel"}
          >
            {pinned ? <Pin size={11} /> : <PinOff size={11} />}
          </button>
          <button
            onClick={() => onClose(id)}
            className="p-0.5 rounded text-[var(--text-3)] hover:text-[var(--rose)] transition-colors"
            title="Close"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-3">
            <span className="font-mono text-[10px] text-[var(--rose)]">
              {error.includes("404")
                ? `${symbol} not found — symbol may not be available in this adapter.`
                : error}
            </span>
          </div>
        )}
        {!error && loading && (
          <div className="flex items-center justify-center h-24">
            <span className="font-mono text-[10px] text-[var(--text-3)] animate-pulse">Loading {symbol}…</span>
          </div>
        )}
        {data && <InstrumentColumn inst={data} resizable />}
      </div>
    </div>
  );
}

// ── WatchlistMode ─────────────────────────────────────────────────────────────
export default function WatchlistMode() {
  const { watchlist, addTicker, removeTicker } = useWatchlist();
  const [zeroDTE, setZeroDTE] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const intervalRef = useRef(null);
  const [refreshInterval] = useState(() => getRefreshInterval("watchlist"));

  const bump = useCallback(() => {
    if (!pausedRef.current) setLocalRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(bump, refreshInterval * 1000);
    return () => clearInterval(intervalRef.current);
  }, [bump, refreshInterval]);

  const togglePause = () => {
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      if (next) {
        clearInterval(intervalRef.current);
      } else {
        setLocalRefreshKey((k) => k + 1);
        intervalRef.current = setInterval(bump, refreshInterval * 1000);
      }
      return next;
    });
  };

  const [panels, setPanels] = useState(() => {
    try {
      const saved = localStorage.getItem("watchlist-panels");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("watchlist-panels", JSON.stringify(panels));
  }, [panels]);

  function handleAddTicker() {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    addTicker(sym);
    openPanel(sym);
    setInput("");
    inputRef.current?.focus();
  }

  function openPanel(sym) {
    const exists = panels.find(p => p.symbol === sym && !p.pinned);
    if (exists) return;
    setPanels(prev => [...prev, { id: `${sym}-${Date.now()}`, symbol: sym, pinned: false }]);
  }

  function handleClose(id) {
    setPanels(prev => prev.filter(p => p.id !== id));
  }

  function handleTogglePin(id) {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  }

  // Pinned panels first, then unpinned
  const sorted = [...panels.filter(p => p.pinned), ...panels.filter(p => !p.pinned)];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="glass-strip flex-none flex flex-wrap items-center gap-2 px-6 py-2.5">
        {/* Input + add button */}
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
            placeholder="Add ticker…"
            className="glass-input font-mono text-[11px] px-3 py-1 rounded-full w-28"
          />
          <button
            onClick={handleAddTicker}
            className="p-1.5 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] transition-colors"
            title="Add ticker"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Chip row — click to open panel */}
        <div className="flex flex-wrap items-center gap-1">
          {watchlist.map((sym) => {
            const isOpen = panels.some(p => p.symbol === sym);
            return (
              <button
                key={sym}
                onClick={() => openPanel(sym)}
                className={cn(
                  "font-mono text-[10px] px-2.5 py-[3px] rounded-full flex items-center gap-1 transition-colors duration-150",
                  isOpen
                    ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
                    : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
                )}
              >
                {sym}
                <span
                  className="opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTicker(sym);
                    setPanels(prev => prev.filter(p => p.symbol !== sym));
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>

        {/* 0DTE toggle */}
        <button
          onClick={() => setZeroDTE((v) => !v)}
          className={cn(
            "flex items-center gap-1 font-mono text-[10px] px-2.5 py-[3px] rounded-full transition-colors duration-150",
            zeroDTE
              ? "text-[var(--gold)] bg-[rgba(232,197,116,0.10)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"
              : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
          )}
          title="Filter to 0DTE expiration"
        >
          <Zap size={11} />
          0DTE
        </button>

        <div className="flex items-center gap-1 ml-auto">
          {panels.length > 0 && (
            <button
              onClick={() => setPanels(prev => prev.filter(p => p.pinned))}
              className="font-mono text-[10px] px-2.5 py-1 rounded-full text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--rose)] transition-colors"
            >
              Close unpinned
            </button>
          )}
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

      {/* Panel canvas */}
      <div className="flex-1 overflow-auto p-4">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-display text-[17px] text-[var(--slate)]">
                {watchlist.length === 0 ? "Add a ticker to get started" : "Click a ticker chip to open a panel"}
              </p>
              <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)] mt-1.5">
                LADDERS OPEN AS PINNED PANELS
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start">
            {sorted.map(p => (
              <WatchPanel
                key={p.id}
                {...p}
                zeroDTE={zeroDTE}
                refreshKey={localRefreshKey}
                onClose={handleClose}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
