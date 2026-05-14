import { useState, useEffect, useRef } from "react";
import { Zap, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";
import { fetchGEXBySymbol } from "@/api";
import InstrumentColumn from "@/components/InstrumentColumn";
import IntradayChart from "@/components/IntradayChart";

export default function WatchlistMode() {
  const { watchlist, addTicker, removeTicker } = useWatchlist();
  const [selected, setSelected] = useState(null);
  const [zeroDTE, setZeroDTE] = useState(false);
  const [input, setInput] = useState("");
  const [instData, setInstData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // When watchlist changes, ensure selected is valid
  useEffect(() => {
    if (watchlist.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !watchlist.includes(selected)) {
      setSelected(watchlist[0]);
    }
  }, [watchlist]);

  // Fetch data when selected or zeroDTE changes
  useEffect(() => {
    if (!selected) {
      setInstData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGEXBySymbol(selected, {
          strikes: 50,
          expiry: zeroDTE ? "0dte" : null,
        });
        if (!cancelled) setInstData(data);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setInstData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selected, zeroDTE]);

  function handleAdd() {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    addTicker(sym);
    setInput("");
    setSelected(sym);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleAdd();
  }

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
            onKeyDown={handleKeyDown}
            placeholder="Add ticker…"
            className="font-mono text-xs px-2 py-1 rounded border bg-transparent outline-none focus:border-blue-400 w-28"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-1)",
              background: "var(--surface-1)",
            }}
          />
          <button
            onClick={handleAdd}
            className="p-1 rounded border hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
            title="Add ticker"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Chip row */}
        <div className="flex flex-wrap items-center gap-1">
          {watchlist.map((sym) => {
            const isActive = sym === selected;
            return (
              <button
                key={sym}
                onClick={() => setSelected(sym)}
                className={cn(
                  "font-mono text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors",
                  isActive
                    ? "border-blue-400/40 bg-blue-400/10 text-blue-400"
                    : "hover:opacity-80",
                )}
                style={
                  isActive
                    ? {}
                    : { borderColor: "var(--border)", color: "var(--text-3)" }
                }
              >
                {sym}
                <span
                  className="opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTicker(sym);
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
            "ml-auto flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded border transition-colors",
            zeroDTE
              ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
              : "hover:opacity-80",
          )}
          style={
            zeroDTE
              ? {}
              : { borderColor: "var(--border)", color: "var(--text-3)" }
          }
          title="Filter to 0DTE expiration"
        >
          <Zap size={11} />
          0DTE
        </button>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {!selected && (
          <div
            className="flex items-center justify-center h-full font-mono text-sm"
            style={{ color: "var(--text-3)" }}
          >
            Add a ticker to get started
          </div>
        )}

        {selected && loading && (
          <div
            className="flex items-center justify-center h-32 font-mono text-sm"
            style={{ color: "var(--text-3)" }}
          >
            <span className="animate-pulse">Loading {selected}…</span>
          </div>
        )}

        {selected && error && (
          <div
            className="m-4 p-4 rounded-xl border font-mono text-sm"
            style={{
              borderColor: "var(--border)",
              color: "var(--red)",
              background: "var(--surface-1)",
            }}
          >
            {error.includes("404")
              ? `${selected} not found — symbol may not be available in this adapter.`
              : error}
          </div>
        )}

        {selected && !loading && !error && instData && (
          <div className="p-4 flex flex-col xl:flex-row gap-4 min-w-0">
            <div className="min-w-0 xl:w-[340px] xl:flex-shrink-0">
              <InstrumentColumn inst={instData} />
            </div>
            <div className="min-w-0 flex-1">
              <IntradayChart symbol={selected} height={480} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
