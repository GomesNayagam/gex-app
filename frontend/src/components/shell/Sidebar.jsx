import { NavLink } from "react-router-dom"
import { LayoutGrid, Star, CalendarRange, Settings2, ChevronLeft, ChevronRight } from "lucide-react"
import { useSidebar } from "@/hooks/useSidebar"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/b3", icon: LayoutGrid, label: "B3 Mode" },
  { to: "/watch", icon: Star, label: "Watchlist" },
  { to: "/expiry", icon: CalendarRange, label: "Expiry View" },
  { to: "/settings", icon: Settings2, label: "Settings" },
]

export default function Sidebar() {
  const [collapsed, toggle] = useSidebar()

  return (
    <div className={cn(
      "flex flex-col shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] transition-[width] duration-200 overflow-hidden",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Logo area */}
      <div className="h-12 flex items-center px-3 border-b border-[var(--border)] shrink-0">
        <span className="font-mono text-[10px] tracking-widest text-[var(--text-3)] uppercase truncate">
          {collapsed ? "GEX" : "GEX · Dashboard"}
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 p-1.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 font-mono text-[10px] tracking-wide transition-colors rounded-sm",
              isActive
                ? "border-l-2 border-blue bg-blue/10 text-[var(--text-1)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-white/5"
            )}
          >
            <Icon size={14} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-1.5 border-t border-[var(--border)] shrink-0">
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center py-2 px-3 text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-white/5 rounded-sm transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </div>
  )
}
