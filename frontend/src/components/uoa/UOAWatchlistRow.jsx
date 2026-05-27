import { useState } from "react"

export default function UOAWatchlistRow({ watchlist, activeSymbol, onSelect, onAdd, onRemove }) {
  const [input, setInput] = useState("")

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      const val = input.trim().toUpperCase()
      if (val) { onAdd(val); setInput("") }
    }
  }

  return (
    <div
      className="shrink-0 border-b font-mono text-[11px] flex flex-wrap items-center gap-1.5 px-3 py-1.5"
      style={{ background: "#0f0f18", borderColor: "#1e1e2a" }}
    >
      <span
        className="text-[10px] uppercase tracking-widest mr-1"
        style={{ color: "#6b6b80" }}
      >
        Watch
      </span>

      {watchlist.map((sym) => (
        <button
          key={sym}
          onClick={() => onSelect(sym)}
          className="flex items-center gap-1 px-2 py-0.5 rounded-sm border font-bold transition-colors"
          style={
            sym === activeSymbol
              ? { background: "#3b82f6", borderColor: "#3b82f6", color: "#fff" }
              : { background: "#16161f", borderColor: "#1e1e2a", color: "#e2e2e8" }
          }
        >
          {sym}
          <span
            onClick={(e) => { e.stopPropagation(); onRemove(sym) }}
            className="ml-0.5 leading-none cursor-pointer"
            style={{ color: sym === activeSymbol ? "rgba(255,255,255,.6)" : "#6b6b80", fontSize: "10px" }}
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
        className="px-2 py-0.5 rounded-sm font-mono uppercase outline-none"
        style={{
          background: "transparent",
          border: "1px dashed #333348",
          color: "#6b6b80",
          fontSize: "11px",
          width: "72px",
        }}
      />
    </div>
  )
}
