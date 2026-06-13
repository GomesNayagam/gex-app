import { useLocation } from "react-router-dom"
import MarketClock from "./MarketClock"
import { HeaderActionsSlot } from "./HeaderActions"

const PAGES = {
  "/b3":       { title: "Gamma Ladders", sub: "SPX · SPY · QQQ — live dealer positioning" },
  "/watch":    { title: "Flow List", sub: "custom tickers — pinned ladders" },
  "/expiry":   { title: "Gamma Horizon", sub: "single-expiry deep dive" },
  "/uoa":      { title: "Flow Signals", sub: "unusual options activity — scored tape" },
  "/agent":    { title: "Agent", sub: "market structure copilot" },
  "/settings": { title: "Settings", sub: "configuration" },
}

export default function TopBar() {
  const { pathname } = useLocation()
  const page = PAGES[pathname] ?? PAGES["/b3"]

  return (
    <div className="glass-strip relative h-[58px] px-6 flex items-center gap-3.5 shrink-0">
      <span className="font-display text-[23px] leading-none tracking-[0.01em] text-[var(--ivory)]">
        {page.title}
      </span>
      <span className="hidden md:block font-mono text-[10px] tracking-[0.08em] text-[var(--slate-dim)]">
        {page.sub}
      </span>

      <div className="flex-1" />

      <HeaderActionsSlot />

      <MarketClock />
    </div>
  )
}
