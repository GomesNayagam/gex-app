import { useState, useEffect, useRef, useCallback } from "react";
import { fetchGEXBySymbol } from "@/api";
import InstrumentColumn from "@/components/InstrumentColumn";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import { getRefreshInterval } from "@/lib/refreshSettings";
import { X, Pin, PinOff, RefreshCw, Pause, Play } from "lucide-react";

// ── Single expiry panel ───────────────────────────────────────────────────────
function ExpiryPanel({ id, symbol, date, pinned, onClose, onTogglePin, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchGEXBySymbol(symbol, { strikes: 50, expiry: date });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [symbol, date, refreshKey]);

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
        <span className="font-mono text-[9px] text-[var(--slate-dim)]">{date}</span>
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
            <span className="font-mono text-[10px] text-[var(--rose)]">{error}</span>
          </div>
        )}
        {!error && !data && !loading && (
          <div className="flex items-center justify-center h-24">
            <span className="font-mono text-[10px] text-[var(--text-3)]">loading…</span>
          </div>
        )}
        {data && <InstrumentColumn inst={data} resizable />}
      </div>
    </div>
  );
}

// ── ExpiryMode ────────────────────────────────────────────────────────────────
export default function ExpiryMode() {
  const { watchlist } = useWatchlist();
  const [symbol, setSymbol] = useState("SPX");
  const [date, setDate] = useState("");
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const intervalRef = useRef(null);
  const [refreshInterval] = useState(() => getRefreshInterval("expiry"));

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
      const saved = localStorage.getItem("expiry-panels");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("expiry-panels", JSON.stringify(panels));
  }, [panels]);

  function handleAdd() {
    if (!symbol.trim() || !date) return;
    const sym = symbol.trim().toUpperCase();
    // Don't duplicate unpinned panels for same symbol+date
    const exists = panels.find(p => p.symbol === sym && p.date === date && !p.pinned);
    if (exists) return;
    setPanels(prev => [...prev, { id: `${sym}-${date}-${Date.now()}`, symbol: sym, date, pinned: false }]);
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
      {/* Top toolbar */}
      <div className="glass-strip flex-none px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol input */}
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Symbol"
            className="glass-input font-mono text-[11px] px-3 py-1 rounded-full w-24 uppercase"
          />

          {/* Watchlist quick-pick */}
          {watchlist.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {watchlist.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSymbol(sym)}
                  className={cn(
                    "font-mono text-[10px] px-2.5 py-[3px] rounded-full transition-colors duration-150",
                    symbol === sym
                      ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
                      : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]"
                  )}
                >
                  {sym}
                </button>
              ))}
            </div>
          )}

          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-input font-mono text-[10px] px-3 py-1 rounded-full"
            style={{ colorScheme: "dark" }}
          />

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!symbol.trim() || !date}
            className="font-mono text-[10px] px-3 py-1 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            + Add Panel
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
      </div>

      {/* Panel canvas */}
      <div className="flex-1 overflow-auto p-4">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="font-display text-[17px] text-[var(--slate)]">
                Pick a symbol and expiration date
              </p>
              <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)] mt-1.5">
                PANELS PIN TO THIS VIEW
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start">
            {sorted.map(p => (
              <ExpiryPanel
                key={p.id}
                {...p}
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
