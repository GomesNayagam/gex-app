import { cn } from "@/lib/utils"
import { useGEXData } from "@/hooks/useGEXData"

const ACCENT = "bg-blue"

function InfoCard({ label, value, accent = ACCENT }) {
  return (
    <div className={cn(
      "relative border border-[var(--border)] bg-[var(--surface-1)] rounded-sm p-3 overflow-hidden"
    )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", accent)} />
      <div className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)] mb-1">{label}</div>
      <div className="font-mono tabular-nums text-[13px] font-semibold text-[var(--text-1)]">{value}</div>
    </div>
  )
}

export default function Settings() {
  const { data } = useGEXData()

  // Try to read adapter/source from data response
  const source = data?.source ?? data?.adapter ?? "—"

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-sm space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
          System Info
        </h2>
        <InfoCard label="Data Source" value={source} accent="bg-blue" />
        <InfoCard label="Refresh Interval" value="30s" accent="bg-green" />
        <InfoCard label="Version" value="GEX Dashboard v2.0" accent="bg-amber" />
      </div>
    </div>
  )
}
