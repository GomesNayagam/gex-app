export default function UOATabsRow({ watchlist, activeSymbol, allData, onSelect }) {
  return (
    <div
      className="shrink-0 flex items-stretch overflow-x-auto"
      style={{ background: "rgba(255,255,255,0.015)", borderBottom: "1px solid var(--edge-soft)" }}
    >
      {watchlist.map((sym) => {
        const entry = allData[sym]
        const isActive = sym === activeSymbol
        const count = entry?.loading ? "…" : (entry?.signals?.signals?.length ?? 0)

        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className="flex items-center gap-1.5 px-4 font-mono text-[11px] font-bold whitespace-nowrap transition-colors"
            style={{
              paddingTop: "6px",
              paddingBottom: "6px",
              borderRight: "1px solid var(--edge-soft)",
              borderBottom: isActive ? "2px solid var(--mint)" : "2px solid transparent",
              background: isActive ? "var(--glass-2)" : "transparent",
              color: isActive ? "var(--ivory)" : "var(--slate-dim)",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isActive ? "var(--mint)" : "var(--slate-dim)",
                display: "inline-block", flexShrink: 0,
              }}
            />
            {sym}
            <span
              className="text-[9px] font-bold px-1 rounded-full"
              style={{
                background: isActive ? "rgba(110,231,199,0.15)" : "var(--glass)",
                color: isActive ? "var(--mint)" : "var(--slate-dim)",
              }}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
