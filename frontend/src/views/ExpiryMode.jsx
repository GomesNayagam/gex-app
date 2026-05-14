import { useState, useEffect } from "react";
import { fetchGEXBySymbol } from "@/api";
import InstrumentColumn from "@/components/InstrumentColumn";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import { X, Pin, PinOff, RefreshCw } from "lucide-react";

// ── Single expiry panel ───────────────────────────────────────────────────────
function ExpiryPanel({ id, symbol, date, pinned, onClose, onTogglePin }) {
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
  }, [symbol, date]);

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
        <span className="font-mono text-[9px] text-[var(--text-3)]">{date}</span>
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
            <span className="font-mono text-[10px] text-[var(--red)]">{error}</span>
          </div>
        )}
        {!error && !data && !loading && (
          <div className="flex items-center justify-center h-24">
            <span className="font-mono text-[10px] text-[var(--text-3)]">loading…</span>
          </div>
        )}
        {data && <InstrumentColumn inst={data} compact />}
      </div>
    </div>
  );
}

// ── ExpiryMode ────────────────────────────────────────────────────────────────
export default function ExpiryMode() {
  const { watchlist } = useWatchlist();
  const [symbol, setSymbol] = useState("SPX");
  const [date, setDate] = useState("");
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
      <div className="flex-none border-b border-[var(--border)] px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Symbol input */}
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Symbol"
            className="bg-transparent border border-[var(--border)] rounded px-2 py-1 font-mono text-[10px] text-[var(--text-1)] w-20 uppercase"
          />

          {/* Watchlist quick-pick */}
          {watchlist.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {watchlist.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSymbol(sym)}
                  className={cn(
                    "font-mono text-[10px] px-2 py-0.5 rounded border transition-colors",
                    symbol === sym
                      ? "border-blue/40 bg-blue/10 text-blue"
                      : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]"
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
            className="rounded px-2 py-1 font-mono text-[10px] border outline-none focus:border-blue/60 transition-colors"
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              colorScheme: "dark",
            }}
          />

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!symbol.trim() || !date}
            className="font-mono text-[10px] px-3 py-1 rounded border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-blue/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            + Add Panel
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
      </div>

      {/* Panel canvas */}
      <div className="flex-1 overflow-auto p-4">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[10px] text-[var(--text-3)]">
              Pick a symbol + date and click <strong className="text-[var(--text-2)]">+ Add Panel</strong>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 items-start">
            {sorted.map(p => (
              <ExpiryPanel
                key={p.id}
                {...p}
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
