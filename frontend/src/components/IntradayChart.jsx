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

export default function IntradayChart({ symbol, instrument, height = 150 }) {
  const { series, loading } = useIntraday(symbol);
  const c = useThemeColors();

  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;

  const snapshots = series?.snapshots ?? [];

  // If no intraday data yet, show a placeholder with current values
  const chartData =
    snapshots.length > 0
      ? snapshots.map((s) => ({
          time: fmt(s.timestamp),
          net_gex: s.net_gex,
          flip: s.flip,
          call_wall: s.call_wall_strike,
          put_wall: s.put_wall_strike,
          spot: s.spot,
        }))
      : [
          {
            time: "now",
            net_gex: instrument?.net_gex ?? 0,
            flip: instrument?.flip ?? 0,
            spot: instrument?.spot ?? 0,
          },
        ];

  const isPos = (instrument?.net_gex ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {snapshots.length === 0 && (
        <p className="font-mono text-[9px] text-text-3 mb-3 text-center">
          Intraday snapshots accumulate as the session progresses (60s interval)
        </p>
      )}
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
            yAxisId="price"
            orientation="right"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 9, fill: c.axis }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={["auto", "auto"]}
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
            yAxisId="price"
            type="monotone"
            dataKey="flip"
            name="Gamma Flip"
            stroke={c.flip}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
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
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
