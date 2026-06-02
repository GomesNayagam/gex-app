export default function UOATabsRow({ watchlist, activeSymbol, allData, onSelect }) {
  return (
    <div
      className="shrink-0 flex items-stretch overflow-x-auto"
      style={{ background: "#0a0a0f", borderBottom: "1px solid #1e1e2a" }}
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
              borderRight: "1px solid #1e1e2a",
              borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              background: isActive ? "#1a1a2a" : "transparent",
              color: isActive ? "#e2e2e8" : "#6b6b80",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: isActive ? "#3b82f6" : "#3d3d50",
                display: "inline-block", flexShrink: 0,
              }}
            />
            {sym}
            <span
              className="text-[9px] font-bold px-1 rounded-full"
              style={{
                background: isActive ? "rgba(59,130,246,.2)" : "#1e1e2a",
                color: isActive ? "#3b82f6" : "#6b6b80",
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

function fmtM(val) {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + "M"
  if (val >= 1_000) return (val / 1_000).toFixed(0) + "K"
  return val.toFixed(0)
}
