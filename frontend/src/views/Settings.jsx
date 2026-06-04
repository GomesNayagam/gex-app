import { useState } from "react"
import { cn } from "@/lib/utils"
import { useGEXData } from "@/hooks/useGEXData"
import { useTheme } from "@/hooks/useTheme"
import {
  REFRESH_STREAMS,
  REFRESH_PRESETS,
  getAllRefreshIntervals,
  setRefreshInterval,
} from "@/lib/refreshSettings"
import { getChatModel, setChatModel } from "@/lib/chatSettings"

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

function ThemePicker() {
  const { theme, setTheme, themes } = useTheme()
  return (
    <select
      value={theme}
      onChange={e => setTheme(e.target.value)}
      className="w-full font-mono text-[11px] uppercase tracking-wider bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--blue)] cursor-pointer"
    >
      {themes.map(t => (
        <option key={t.id} value={t.id}>
          {t.label} — {t.description}
        </option>
      ))}
    </select>
  )
}

function RefreshIntervals() {
  const [intervals, setIntervals] = useState(() => getAllRefreshIntervals())

  function update(key, value) {
    setRefreshInterval(key, value)
    setIntervals((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-3">
      {REFRESH_STREAMS.map((stream) => (
        <div key={stream.key} className="flex items-center justify-between gap-3">
          <label
            htmlFor={`refresh-${stream.key}`}
            className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-2)]"
          >
            {stream.label}
          </label>
          <select
            id={`refresh-${stream.key}`}
            value={intervals[stream.key]}
            onChange={(e) => update(stream.key, Number(e.target.value))}
            className="font-mono text-[11px] uppercase tracking-wider bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--blue)] cursor-pointer"
          >
            {REFRESH_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <p className="font-mono text-[9px] leading-relaxed text-[var(--text-3)]">
        How often each view polls the API. Use the Pause button in a view to
        stop polling entirely. Changes apply when you next open the view.
      </p>
    </div>
  )
}

function AIModelInput() {
  const [value, setValue] = useState(() => getChatModel())

  function onChange(e) {
    setValue(e.target.value)
    setChatModel(e.target.value)
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="deepseek/deepseek-v4-flash"
        className="w-full font-mono text-[11px] bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)] rounded-sm px-3 py-2 focus:outline-none focus:border-[var(--blue)] placeholder:text-[var(--text-3)]"
      />
      <p className="font-mono text-[9px] leading-relaxed text-[var(--text-3)]">
        OpenRouter model slug, e.g. <code>anthropic/claude-sonnet-4-5</code>. Leave blank to use
        the server default. See openrouter.ai/models.
      </p>
    </div>
  )
}

export default function Settings() {
  const { data } = useGEXData()
  const source = data?.source ?? data?.adapter ?? "—"

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-sm space-y-6">
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
            Theme
          </h2>
          <ThemePicker />
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
            Refresh Intervals
          </h2>
          <RefreshIntervals />
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
            AI Assistant
          </h2>
          <AIModelInput />
        </section>

        <section className="space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-3)] mb-4">
            System Info
          </h2>
          <InfoCard label="Data Source" value={source} accent="bg-blue" />
          <InfoCard label="Version" value="GEX Dashboard v2.0" accent="bg-amber" />
        </section>
      </div>
    </div>
  )
}
