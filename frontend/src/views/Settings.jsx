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
import {
  MODELS,
  getCustomModels,
  saveCustomModels,
} from "@/lib/chatSettings"
import { useAISessions } from "@/hooks/useAISessions"

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

function AgentModelsSection() {
  const [custom, setCustom] = useState(() => getCustomModels())
  const [draft, setDraft] = useState("")
  // refinePersona uses sessions loaded at mount time; navigating from AgentView first ensures freshness
  const { refinePersona } = useAISessions()
  const [refining, setRefining] = useState(false)
  const [refined, setRefined] = useState(false)

  function addModel() {
    const trimmed = draft.trim()
    if (!trimmed || custom.includes(trimmed) || MODELS.includes(trimmed)) return
    const next = [...custom, trimmed]
    setCustom(next)
    saveCustomModels(next)
    setDraft("")
  }

  function removeModel(m) {
    const next = custom.filter(x => x !== m)
    setCustom(next)
    saveCustomModels(next)
  }

  async function handleRefine() {
    setRefining(true)
    try {
      await refinePersona()
      setRefined(true)
      setTimeout(() => setRefined(false), 2000)
    } finally {
      setRefining(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)]">Built-in models</p>
        {MODELS.map(m => (
          <div key={m} className="font-mono text-[10px] text-[var(--text-2)] px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm">
            {m}
          </div>
        ))}
      </div>

      {custom.length > 0 && (
        <div className="space-y-1">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-3)]">Custom models</p>
          {custom.map(m => (
            <div key={m} className="flex items-center gap-2">
              <span className="flex-1 font-mono text-[10px] text-[var(--text-2)] px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-sm truncate">
                {m}
              </span>
              <button
                onClick={() => removeModel(m)}
                className="font-mono text-[9px] text-[var(--text-3)] hover:text-red-400 transition-colors px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addModel()}
          placeholder="openrouter model slug…"
          className="flex-1 font-mono text-[10px] bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)] rounded-sm px-2 py-1.5 focus:outline-none focus:border-[var(--blue)] placeholder:text-[var(--text-3)]"
        />
        <button
          onClick={addModel}
          className="font-mono text-[9px] uppercase tracking-wider px-3 py-1.5 border border-[var(--border)] rounded-sm text-[var(--text-2)] hover:border-[var(--blue)] hover:text-[var(--text-1)] transition-colors"
        >
          Add
        </button>
      </div>

      <button
        onClick={handleRefine}
        disabled={refining}
        className={cn(
          "w-full font-mono text-[10px] uppercase tracking-wider py-2 rounded-sm border transition-colors",
          refined
            ? "border-green-500/50 text-green-400"
            : "border-[var(--border)] text-[var(--text-2)] hover:border-[var(--blue)] hover:text-[var(--text-1)]",
          refining && "opacity-50 cursor-not-allowed"
        )}
      >
        {refining ? "Refining…" : refined ? "Refined ✓" : "Refine Agent Now"}
      </button>
      <p className="font-mono text-[9px] leading-relaxed text-[var(--text-3)]">
        Analyzes your last 5 sessions to silently tune the agent's persona toward your trading style.
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
            Agent Models
          </h2>
          <AgentModelsSection />
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
