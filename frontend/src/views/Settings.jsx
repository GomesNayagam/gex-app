import { useState } from "react"
import { cn } from "@/lib/utils"
import { useGEXData } from "@/hooks/useGEXData"
import { getGEXSource, setGEXSource } from "@/api"
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

// ── primitives ──────────────────────────────────────────────────────────────

function SettingLabel({ children }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--slate-dim)] mb-1.5">
      {children}
    </p>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="glass-panel relative p-3.5 overflow-hidden">
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--mint)]" />
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--slate-dim)] mb-1 pl-2">{label}</div>
      <div className="font-mono tabular-nums text-[13px] font-semibold text-[var(--ivory)] pl-2">{value}</div>
    </div>
  )
}

function Hint({ children }) {
  return (
    <p className="font-mono text-[9px] leading-relaxed text-[var(--slate-dim)] mt-2">{children}</p>
  )
}

// ── panel sections ───────────────────────────────────────────────────────────

function DataPanel() {
  const [intervals, setIntervals] = useState(() => getAllRefreshIntervals())
  const [source, setSource] = useState(getGEXSource)

  function updateInterval(key, value) {
    setRefreshInterval(key, value)
    setIntervals(prev => ({ ...prev, [key]: value }))
  }

  function pickSource(v) {
    setGEXSource(v)
    setSource(v)
  }

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
      {/* refresh intervals — left col */}
      <div>
        <SettingLabel>Refresh Intervals</SettingLabel>
        <div className="space-y-2">
          {REFRESH_STREAMS.map(stream => (
            <div key={stream.key} className="flex items-center justify-between gap-3">
              <label
                htmlFor={`refresh-${stream.key}`}
                className="font-mono text-[10px] text-[var(--text-2)] truncate"
              >
                {stream.label}
              </label>
              <select
                id={`refresh-${stream.key}`}
                value={intervals[stream.key]}
                onChange={e => updateInterval(stream.key, Number(e.target.value))}
                className="font-mono text-[10px] bg-[var(--glass)] text-[var(--ivory)] shadow-[inset_0_0_0_1px_var(--edge)] rounded-full border-0 px-3 py-1 focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(232,197,116,0.55)] cursor-pointer shrink-0"
              >
                {REFRESH_PRESETS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Hint>Changes apply when you next open the view.</Hint>
      </div>

      {/* GEX endpoint — right col */}
      <div>
        <SettingLabel>GEX Endpoint</SettingLabel>
        <div className="flex gap-2">
          {["flow", "exposure"].map(v => (
            <button
              key={v}
              onClick={() => pickSource(v)}
              className={cn(
                "flex-1 font-mono text-[11px] uppercase tracking-wider py-2 rounded-full transition-colors",
                source === v
                  ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.3)]"
                  : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <Hint>Switch to <strong>exposure</strong> if the /flow endpoint is down. Takes effect on next refresh.</Hint>
      </div>
    </div>
  )
}

function AgentPanel() {
  const [custom, setCustom] = useState(() => getCustomModels())
  const [draft, setDraft] = useState("")
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
    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
      {/* built-in + custom models — left col */}
      <div className="space-y-4">
        <div>
          <SettingLabel>Built-in Models</SettingLabel>
          <div className="space-y-1">
            {MODELS.map(m => (
              <div key={m} className="font-mono text-[10px] text-[var(--text-2)] px-3 py-1 bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge-soft)] rounded-full">
                {m}
              </div>
            ))}
          </div>
        </div>

        {custom.length > 0 && (
          <div>
            <SettingLabel>Custom Models</SettingLabel>
            <div className="space-y-1">
              {custom.map(m => (
                <div key={m} className="flex items-center gap-2">
                  <span className="flex-1 font-mono text-[10px] text-[var(--text-2)] px-3 py-1 bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge-soft)] rounded-full truncate">
                    {m}
                  </span>
                  <button
                    onClick={() => removeModel(m)}
                    className="font-mono text-[9px] text-[var(--slate-dim)] hover:text-[var(--rose)] transition-colors px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addModel()}
            placeholder="openrouter model slug…"
            className="glass-input flex-1 font-mono text-[10px] px-3 py-1.5 rounded-full"
          />
          <button
            onClick={addModel}
            className="font-mono text-[9px] uppercase tracking-wider px-3.5 py-1.5 rounded-full text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)] transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* persona refinement — right col */}
      <div>
        <SettingLabel>Persona</SettingLabel>
        <button
          onClick={handleRefine}
          disabled={refining}
          className={cn(
            "w-full font-mono text-[10px] uppercase tracking-wider py-2 rounded-full transition-colors",
            refined
              ? "text-[var(--mint)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.4)]"
              : "text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)]",
            refining && "opacity-50 cursor-not-allowed"
          )}
        >
          {refining ? "Refining…" : refined ? "Refined ✓" : "Refine Agent Now"}
        </button>
        <Hint>Analyzes your last 5 sessions to silently tune the agent's persona toward your trading style.</Hint>
      </div>
    </div>
  )
}

function SystemPanel({ adapterSource }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <InfoCard label="Data Source" value={adapterSource} />
      <InfoCard label="Version" value="GEX Dashboard v2.0" />
    </div>
  )
}

// ── nav config ───────────────────────────────────────────────────────────────

const NAV = [
  { id: "data",    label: "Data",    icon: "⬡" },
  { id: "agent",   label: "Agent",   icon: "◎" },
  { id: "system",  label: "System",  icon: "◇" },
]

// ── root ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { data } = useGEXData()
  const adapterSource = data?.source ?? data?.adapter ?? "—"
  const [active, setActive] = useState("data")

  return (
    <div className="h-full flex overflow-hidden">
      {/* sidebar nav */}
      <nav className="w-40 shrink-0 border-r border-[var(--edge-soft)] bg-[rgba(255,255,255,0.02)] backdrop-blur-xl flex flex-col py-4 gap-1 px-2.5">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={cn(
              "flex items-center gap-2.5 px-2 py-2 rounded-full text-left transition-colors font-mono text-[11px] uppercase tracking-wider w-full",
              active === item.id
                ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.22)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--glass)]"
            )}
          >
            <span className="text-[var(--slate-dim)] text-[12px] leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* content area */}
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="font-display text-[19px] text-[var(--ivory)] mb-6">
          {NAV.find(n => n.id === active)?.label}
        </h1>

        {active === "data"    && <DataPanel />}
        {active === "agent"   && <AgentPanel />}
        {active === "system"  && <SystemPanel adapterSource={adapterSource} />}
      </div>
    </div>
  )
}
