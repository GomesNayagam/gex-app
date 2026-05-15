import { useState, useEffect, useRef } from "react";
import { Zap, Plus, X, Pin, PinOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { fetchGEXBySymbol } from "@/api";
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
        "flex flex-col border rounded-sm bg-[var(--surface-1)] min-w-[320px] flex-shrink-0",
        pinned ? "border-blue/40" : "border-[var(--border)]"
      )}
      style={{ width: "360px" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] flex-none">
        <span className="font-mono text-[10px] font-semibold text-[var(--text-1)]">{symbol}</span>
        {zeroDTE && <span className="font-mono text-[8px] uppercase tracking-widest text-amber">0DTE</span>}
        {pinned && <span className="font-mono text-[8px] uppercase tracking-widest text-blue ml-0.5">pinned</span>}
        <div className="flex items-center gap-1 ml-auto">
          {loading && <RefreshCw size={10} className="animate-spin text-[var(--text-3)]" />}
          <button
            onClick={() => onTogglePin(id)}
            className={cn(
              "p-0.5 rounded transition-colors",
              pinned ? "text-blue" : "text-[var(--text-3)] hover:text-[var(--text-2)]"
            )}
            title={pinned ? "Unpin" : "Pin panel"}
          >
            {pinned ? <Pin size={11} /> : <PinOff size={11} />}
          </button>
          <button
            onClick={() => onClose(id)}
            className="p-0.5 rounded text-[var(--text-3)] hover:text-[var(--red)] transition-colors"
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
            <span className="font-mono text-[10px] text-[var(--red)]">
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
export default function WatchlistMode({ refreshKey = 0 }) {
  const { watchlist, addTicker, removeTicker } = useWatchlist();
  const [zeroDTE, setZeroDTE] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

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
      <div
        className="flex-none flex flex-wrap items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Input + add button */}
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
            placeholder="Add ticker…"
            className="font-mono text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-blue-400 w-28"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-1)",
              background: "var(--surface-1)",
            }}
          />
          <button
            onClick={handleAddTicker}
            className="p-1 rounded border hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
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
                  "font-mono text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors",
                  isOpen
                    ? "border-blue-400/40 bg-blue-400/10 text-blue-400"
                    : "hover:opacity-80",
                )}
                style={isOpen ? {} : { borderColor: "var(--border)", color: "var(--text-3)" }}
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
            "flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border transition-colors",
            zeroDTE
              ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
              : "hover:opacity-80",
          )}
          style={zeroDTE ? {} : { borderColor: "var(--border)", color: "var(--text-3)" }}
          title="Filter to 0DTE expiration"
        >
          <Zap size={11} />
          0DTE
        </button>

        {panels.length > 0 && (
          <button
            onClick={() => setPanels(prev => prev.filter(p => p.pinned))}
            className="font-mono text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--red)] transition-colors ml-auto"
          >
            Close unpinned
          </button>
        )}
      </div>

      {/* Panel canvas */}
      <div className="flex-1 overflow-auto p-4">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[10px] text-[var(--text-3)]">
              {watchlist.length === 0
                ? "Add a ticker to get started"
                : "Click a ticker chip to open a panel"}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start">
            {sorted.map(p => (
              <WatchPanel
                key={p.id}
                {...p}
                zeroDTE={zeroDTE}
                refreshKey={refreshKey}
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
