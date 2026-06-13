import { useState } from "react";

export default function UOAWatchlistRow({
  watchlist,
  activeSymbol,
  onSelect,
  onAdd,
  onRemove,
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      const val = input.trim().toUpperCase();
      if (val) {
        onAdd(val);
        setInput("");
      }
    }
  }

  return (
    <div
      className="glass-strip shrink-0 font-mono text-[11px] flex flex-wrap items-center gap-1.5 px-6 py-2"
    >
      <span
        className="text-[10px] uppercase tracking-widest mr-1 text-[var(--slate-dim)]"
      >
        Watch
      </span>

      {watchlist.map((sym) => (
        <button
          key={sym}
          onClick={() => onSelect(sym)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full font-bold transition-colors"
          style={
            sym === activeSymbol
              ? { background: "rgba(110,231,199,0.10)", color: "#6ee7c7", boxShadow: "inset 0 0 0 1px rgba(110,231,199,0.3)" }
              : {
                  background: "var(--glass)",
                  color: "var(--slate)",
                  boxShadow: "inset 0 0 0 1px var(--edge-soft)",
                }
          }
        >
          {sym}
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRemove(sym);
            }}
            className="ml-0.5 leading-none cursor-pointer"
            style={{
              color: sym === activeSymbol ? "rgba(110,231,199,0.6)" : "var(--slate-dim)",
              fontSize: "10px",
            }}
          >
            ✕
          </span>
        </button>
      ))}

      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        placeholder="+ TICKER"
        maxLength={8}
        className="glass-input font-mono text-[11px] uppercase px-2.5 py-[3px] rounded-full w-[80px]"
        style={{ borderStyle: "dashed" }}
      />
    </div>
  );
}
