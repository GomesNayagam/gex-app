import MarketClock from "./MarketClock"

export default function TopBar() {
  const now = new Date()
  const tsLabel = now.toISOString().slice(0, 10) + " · " + now.toISOString().slice(11, 19) + " UTC"

  return (
    <div className="relative h-12 border-b border-[var(--border)] bg-[var(--surface-1)] px-4 flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="text-xl font-black tracking-tight leading-none" style={{ letterSpacing: "-0.08em" }}>
          <span className="text-[#38bdf8]">G</span><span className="text-[var(--text-1)]">ED</span>
        </span>
        <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />
        <span className="hidden sm:block text-[9px] font-medium tracking-[0.2em] uppercase text-[var(--text-3)]">
          Gamma Exposure Dashboard
        </span>
      </div>

      <div className="flex-1" />

      <MarketClock />

      <div className="font-mono text-[9px] text-[var(--text-3)] text-right hidden md:block">
        <div>{tsLabel}</div>
        <div className="opacity-60 mt-0.5">options market structure</div>
      </div>
    </div>
  )
}
