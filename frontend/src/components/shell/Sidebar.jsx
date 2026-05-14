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
      {/* Logo area + collapse toggle */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--border)] shrink-0">
        {!collapsed && (
          <span className="font-mono text-[11px] font-semibold tracking-widest text-[var(--text-2)] uppercase truncate">
            GEX · Dashboard
          </span>
        )}
        <button
          onClick={toggle}
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-white/10 transition-colors",
            collapsed && "mx-auto"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 p-2 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 font-mono text-[11px] tracking-wide transition-colors rounded-sm",
              collapsed && "justify-center px-0",
              isActive
                ? "border-l-2 border-blue bg-blue/10 text-white"
                : "text-[var(--text-2)] hover:text-white hover:bg-white/8"
            )}
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
