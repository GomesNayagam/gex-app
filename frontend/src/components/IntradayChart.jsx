import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useIntraday } from "@/hooks/useIntraday";
import { fmtGex } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART } from "@/lib/palette";

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel px-3 py-2 font-mono text-[10px]">
      <p className="text-[var(--slate-dim)] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{" "}
          {p.dataKey === "net_gex"
            ? fmtGex(p.value)
            : p.dataKey === "spot"
              ? p.value?.toFixed(2)
              : p.value?.toFixed(2)}
        </p>
      ))}
    </div>
  );
};

function isMarketHours() {
  const now = new Date();
  // Convert to ET
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export default function IntradayChart({ symbol, instrument, height = 150 }) {
  const { series, loading } = useIntraday(symbol);
  const c = CHART;

  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;

  const snapshots = series?.snapshots ?? [];
  const inSession = isMarketHours();

  const chartData = snapshots.map((s) => ({
    time: fmt(s.timestamp),
    net_gex: s.net_gex,
    flip: s.flip,
    call_wall: s.call_wall_strike,
    put_wall: s.put_wall_strike,
    spot: s.spot,
  }));

  const isPos = (instrument?.net_gex ?? 0) >= 0;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] text-[var(--slate-dim)]">
          Session · 6:30 AM – 1:00 PM PT
        </span>
        <span
          className={`font-mono text-[9px] ${inSession ? "text-[var(--mint)]" : "text-[var(--slate-dim)]"}`}
        >
          {inSession ? "● live" : "● closed"}
        </span>
      </div>
      {snapshots.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-display text-[15px] text-[var(--slate)]">
            {inSession ? "Waiting for snapshots" : "Market is closed"}
          </p>
          <p className="font-mono text-[9px] text-[var(--slate-dim)] mt-1">
            {inSession
              ? "Snapshots accumulate during the session (60s interval)"
              : "No session data"}
          </p>
        </div>
      ) : null}
      {snapshots.length === 0 ? null : (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={c.grid}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: c.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="gex"
            orientation="left"
            tickFormatter={(v) => fmtGex(v)}
            tick={{ fontFamily: "JetBrains Mono", fontSize: 9, fill: c.axis }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <YAxis
            yAxisId="spot"
            orientation="right"
            hide
            domain={["auto", "auto"]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="gex" y={0} stroke={c.grid} strokeWidth={1} />
          <Line
            yAxisId="gex"
            type="monotone"
            dataKey="net_gex"
            name="Net GEX"
            stroke={isPos ? c.pos : c.neg}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: isPos ? c.pos : c.neg }}
            style={{ filter: isPos ? "drop-shadow(0 0 6px rgba(110,231,199,0.45))" : "drop-shadow(0 0 6px rgba(240,138,155,0.4))" }}
          />
          <Line
            yAxisId="spot"
            type="monotone"
            dataKey="spot"
            name="Spot"
            stroke={c.gold}
            strokeWidth={2}
            dot={false}
            connectNulls
            strokeDasharray="3 5"
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
