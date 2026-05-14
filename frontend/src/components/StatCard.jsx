import { cn } from "@/lib/utils"

const ACCENT = {
  call:   "border-green/25 bg-green/5 [--accent:#2dc88a]",
  flip:   "border-blue/25 bg-blue/5 [--accent:#4d8fea]",
  put:    "border-red/25 bg-red/5 [--accent:#e05252]",
  pin:    "border-amber/25 bg-amber/5 [--accent:#d4a843]",
  dealer: "border-purple-500/25 bg-purple-500/5 [--accent:#a855f7]",
}

const TEXT_COLOR = {
  call:   "text-green",
  flip:   "text-blue",
  put:    "text-red",
  pin:    "text-amber",
  dealer: "text-purple-400",
}

export default function StatCard({ type, label, value, sub1, sub2 }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-lg border p-3 flex flex-col gap-1",
      ACCENT[type]
    )}>
      {/* top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)]" />

      <p className="font-mono text-[10px] uppercase tracking-widest text-text-2">{label}</p>

      <p className={cn("font-mono text-sm font-semibold leading-none", TEXT_COLOR[type])}>
        {value}
      </p>

      <div className="font-mono text-[10px] text-text-2 leading-relaxed">
        <span dangerouslySetInnerHTML={{ __html: sub1 }} />
        {sub2 && <><br /><span>{sub2}</span></>}
      </div>
    </div>
  )
}
