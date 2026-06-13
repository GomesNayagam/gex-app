import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Star,
  CalendarRange,
  Settings2,
  Flame,
  BotMessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/b3", icon: LayoutGrid, label: "Gamma Ladders" },
  { to: "/watch", icon: Star, label: "Flow List" },
  { to: "/expiry", icon: CalendarRange, label: "Gamma Horizon" },
  { to: "/uoa", icon: Flame, label: "Flow Signals" },
  { to: "/agent", icon: BotMessageSquare, label: "Agent" },
];

function RailLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          "flex items-center justify-center w-[38px] h-[38px] rounded-[11px] transition-all duration-150",
          isActive
            ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.22),0_0_18px_rgba(110,231,199,0.07)]"
            : "text-[var(--slate-dim)] hover:text-[var(--slate)] hover:bg-[var(--glass)]",
        )
      }
    >
      <Icon size={17} strokeWidth={1.6} />
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <div className="flex flex-col items-center shrink-0 w-[60px] py-3.5 gap-1.5 bg-[rgba(255,255,255,0.025)] border-r border-[var(--edge-soft)] backdrop-blur-xl">
      <span
        className="font-display text-[15px] leading-none text-[var(--ivory)] mb-4 select-none"
        title="Gamma Exposure Dashboard"
      >
        GED<span className="text-[var(--gold)]">.</span>
      </span>

      <nav className="flex flex-col items-center gap-1.5">
        {NAV_ITEMS.map((item) => (
          <RailLink key={item.to} {...item} />
        ))}
      </nav>

      <div className="flex-1" />

      <RailLink to="/settings" icon={Settings2} label="Settings" />
    </div>
  );
}
