import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X, PanelLeftClose, PanelLeftOpen, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

const COLLAPSE_KEY = "gex.agentSidebar.collapsed"

function relativeTime(ts) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function SessionRow({ session, isActive, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== session.title) onRename(session.id, trimmed)
    setEditing(false)
  }

  function cancelRename() {
    setDraft(session.title)
    setEditing(false)
  }

  return (
    <div
      onClick={() => !editing && onSelect(session.id)}
      className={cn(
        "group relative flex flex-col px-3 py-2.5 cursor-pointer rounded-sm transition-colors",
        isActive
          ? "border-l-2 border-[var(--blue)] bg-[var(--blue-dim)] text-[var(--text-1)]"
          : "border-l-2 border-transparent text-[var(--text-2)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
      )}
    >
      {editing ? (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") cancelRename()
            }}
            className="flex-1 min-w-0 font-mono text-[10px] bg-[var(--surface-2)] border border-[var(--blue)] rounded-sm px-1.5 py-0.5 text-[var(--text-1)] focus:outline-none"
          />
          <button onClick={commitRename} className="text-[var(--blue)] hover:opacity-70">
            <Check size={12} />
          </button>
          <button onClick={cancelRename} className="text-[var(--text-3)] hover:opacity-70">
            <X size={12} />
          </button>
        </div>
      ) : (
        <>
          <span className="font-mono text-[10px] truncate leading-snug pr-10">
            {session.title}
          </span>
          <span className="font-mono text-[9px] text-[var(--text-3)] mt-0.5">
            {relativeTime(session.createdAt)}
          </span>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); setEditing(true) }}
              className="p-1 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
              title="Rename"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(session.id) }}
              className="p-1 text-[var(--text-3)] hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function AgentSidebar({ sessions, activeId, onSelect, onNew, onRename, onDelete }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "true"
    } catch {
      return false
    }
  })

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(COLLAPSE_KEY, String(next)) } catch {}
      return next
    })
  }

  if (collapsed) {
    return (
      <div className="flex flex-col w-12 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] overflow-hidden items-center py-3 gap-2">
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors"
          title="Expand sidebar"
        >
          <PanelLeftOpen size={14} />
        </button>
        <button
          onClick={onNew}
          className="p-1.5 rounded-sm border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--blue)] hover:text-[var(--text-1)] transition-colors"
          title="New Chat"
        >
          <Plus size={14} />
        </button>
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 mt-1">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              title={session.title}
              className={cn(
                "p-1.5 rounded-sm border-l-2 transition-colors",
                session.id === activeId
                  ? "border-[var(--blue)] bg-[var(--blue-dim)] text-[var(--text-1)]"
                  : "border-transparent text-[var(--text-3)] hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
              )}
            >
              <MessageSquare size={14} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
      <div className="p-3 border-b border-[var(--border)] shrink-0 flex items-center gap-2">
        <button
          onClick={onNew}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-sm",
            "font-mono text-[10px] uppercase tracking-wider",
            "border border-[var(--border)] text-[var(--text-2)]",
            "hover:border-[var(--blue)] hover:text-[var(--text-1)] transition-colors"
          )}
        >
          <Plus size={12} /> New Chat
        </button>
        <button
          onClick={toggleCollapsed}
          className="p-2 rounded-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)] transition-colors shrink-0"
          title="Collapse sidebar"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sessions.map(session => (
          <SessionRow
            key={session.id}
            session={session}
            isActive={session.id === activeId}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}
