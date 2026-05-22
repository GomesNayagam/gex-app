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
import { useThemeColors } from "@/hooks/useTheme";

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[10px]">
      <p className="text-text-2 mb-1">{label}</p>
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
  const c = useThemeColors();

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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] text-text-3">
          Session · 6:30 AM – 1:00 PM PT
        </span>
        <span
          className={`font-mono text-[9px] ${inSession ? "text-green-400" : "text-text-3"}`}
        >
          {inSession ? "● live" : "● closed"}
        </span>
      </div>
      {snapshots.length === 0 ? (
        <p className="font-mono text-[9px] text-text-3 py-8 text-center">
          {inSession
            ? "Snapshots accumulate during the session (60s interval)"
            : "No session data — market is closed"}
        </p>
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
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 9, fill: c.axis }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="gex"
            orientation="left"
            tickFormatter={(v) => fmtGex(v)}
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 9, fill: c.axis }}
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
          />
          <Line
            yAxisId="spot"
            type="monotone"
            dataKey="spot"
            name="Spot"
            stroke="#d89a48"
            strokeWidth={2}
            dot={false}
            connectNulls
            strokeDasharray={2,3}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </div>
  );
}
