# AgentView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating AI chat bubble with a full-page AgentView at `/agent` featuring multi-session management, per-session model selection, and a silent self-improvement persona loop.

**Architecture:** A new `useAISessions` hook owns all session state in localStorage. `AgentView` is a two-pane layout (session sidebar + chat pane) wired into React Router alongside existing views. A `refinePersona` utility calls the backend chat endpoint to silently update a stored persona prompt that is prepended to every `streamChat` call.

**Tech Stack:** React 18, Vite, Tailwind CSS v3, React Router v6, localStorage, `streamChat` (existing SSE fetch in `api.js`), lucide-react icons.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `frontend/src/lib/chatSettings.js` | Add `MODELS`, `getCustomModels`, `saveCustomModels`, `getPersona`, `savePersona` |
| Create | `frontend/src/hooks/useAISessions.js` | All session CRUD + streaming + persona refinement |
| Create | `frontend/src/views/AgentView.jsx` | Two-pane layout, instantiates hook, passes props |
| Create | `frontend/src/components/ai/AgentSidebar.jsx` | Session list panel with new/rename/delete |
| Create | `frontend/src/components/ai/AgentChat.jsx` | Chat pane: header, messages, input |
| Modify | `frontend/src/components/ai/ChatMessage.jsx` | Add clipboard copy button on assistant messages |
| Modify | `frontend/src/App.jsx` | Add `/agent` route, import AgentView |
| Modify | `frontend/src/components/shell/Sidebar.jsx` | Add Agent nav link |
| Modify | `frontend/src/components/shell/AppShell.jsx` | Remove `<ChatWidget />` |
| Modify | `frontend/src/views/Settings.jsx` | Replace `AIModelInput` with `AgentModelsSection` + `RefineAgentButton` |
| Delete | `frontend/src/hooks/useAIChat.js` | Replaced by `useAISessions` |
| Delete | `frontend/src/components/ai/ChatWidget.jsx` | Bubble removed |

---

## Task 1: Extend `chatSettings.js` with models, custom models, and persona helpers

**Files:**
- Modify: `frontend/src/lib/chatSettings.js`

- [ ] **Step 1: Replace the file contents**

```js
const MODEL_KEY = "ai-chat-model"         // legacy — keep for now, unused after migration
const CUSTOM_MODELS_KEY = "ai-custom-models"
const PERSONA_KEY = "ai-agent-persona"

export const MODELS = [
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "mistralai/mistral-large",
  "deepseek/deepseek-v4-flash",
]

export function getCustomModels() {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY)
    const parsed = JSON.parse(raw || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomModels(models) {
  try {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models))
  } catch {}
}

export function getAllModels() {
  return [...MODELS, ...getCustomModels()]
}

export function getPersona() {
  try {
    return localStorage.getItem(PERSONA_KEY) || ""
  } catch {
    return ""
  }
}

export function savePersona(text) {
  try {
    if (text) {
      localStorage.setItem(PERSONA_KEY, text)
    } else {
      localStorage.removeItem(PERSONA_KEY)
    }
  } catch {}
}

// Legacy helpers — kept so Settings.jsx doesn't break before Task 8
export function getChatModel() {
  try { return localStorage.getItem(MODEL_KEY) ?? "" } catch { return "" }
}
export function setChatModel(value) {
  try {
    const t = (value ?? "").trim()
    if (t) { localStorage.setItem(MODEL_KEY, t) } else { localStorage.removeItem(MODEL_KEY) }
  } catch {}
}
```

- [ ] **Step 2: Verify no import errors**

Run: `cd frontend && npm run build -- --mode development 2>&1 | head -30`  
Expected: no errors related to `chatSettings`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/chatSettings.js
git commit -m "feat: extend chatSettings with models list, custom models, and persona helpers"
```

---

## Task 2: Create `useAISessions` hook

**Files:**
- Create: `frontend/src/hooks/useAISessions.js`

- [ ] **Step 1: Create the file**

```js
import { useState, useCallback, useRef } from "react"
import { streamChat } from "@/api"
import { getAllModels, getPersona, savePersona, MODELS } from "@/lib/chatSettings"

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

const SESSIONS_KEY = "ai-sessions"
const ACTIVE_KEY = "ai-active-session"

function loadState() {
  try {
    const sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]")
    const activeId = localStorage.getItem(ACTIVE_KEY) || null
    return {
      sessions: Array.isArray(sessions) ? sessions : [],
      activeId,
    }
  } catch {
    return { sessions: [], activeId: null }
  }
}

function persistSessions(sessions) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)) } catch {}
}

function persistActive(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {}
}

function makeSession(model) {
  return {
    id: genId(),
    title: "New Chat",
    createdAt: Date.now(),
    model: model || MODELS[0],
    messages: [],
  }
}

export function useAISessions() {
  const [{ sessions, activeId }, setState] = useState(() => {
    const s = loadState()
    // Ensure there's always at least one session
    if (s.sessions.length === 0) {
      const blank = makeSession()
      return { sessions: [blank], activeId: blank.id }
    }
    const aid = s.activeId && s.sessions.find(x => x.id === s.activeId)
      ? s.activeId
      : s.sessions[0].id
    return { sessions: s.sessions, activeId: aid }
  })
  const [loading, setLoading] = useState(false)
  const abortRef = useRef(false)

  function _set(updater) {
    setState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater
      persistSessions(next.sessions)
      persistActive(next.activeId)
      return next
    })
  }

  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0] ?? null

  const newSession = useCallback(() => {
    // Trigger persona refinement on the session being left
    const leaving = sessions.find(s => s.id === activeId)
    if (leaving && leaving.messages.length > 0) {
      _runRefinement([leaving]).catch(() => {})
    }
    const blank = makeSession(getAllModels()[0])
    _set(prev => ({
      sessions: [blank, ...prev.sessions],
      activeId: blank.id,
    }))
  }, [sessions, activeId])

  const setActiveId = useCallback((id) => {
    _set(prev => ({ ...prev, activeId: id }))
  }, [])

  const renameSession = useCallback((id, title) => {
    _set(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, title } : s),
    }))
  }, [])

  const deleteSession = useCallback((id) => {
    _set(prev => {
      const remaining = prev.sessions.filter(s => s.id !== id)
      if (remaining.length === 0) {
        const blank = makeSession()
        return { sessions: [blank], activeId: blank.id }
      }
      const newActive = prev.activeId === id ? remaining[0].id : prev.activeId
      return { sessions: remaining, activeId: newActive }
    })
  }, [])

  const setSessionModel = useCallback((id, model) => {
    _set(prev => ({
      ...prev,
      sessions: prev.sessions.map(s => s.id === id ? { ...s, model } : s),
    }))
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading || !activeSession) return

    const userMsg = { role: "user", content: text.trim(), id: genId() }
    const assistantMsg = { role: "assistant", content: "", id: genId(), toolNames: [] }

    // Auto-title from first message
    const isFirst = activeSession.messages.length === 0
    const autoTitle = isFirst ? text.trim().slice(0, 60) : null

    let historyMessages
    _set(prev => {
      const sessions = prev.sessions.map(s => {
        if (s.id !== prev.activeId) return s
        const updated = {
          ...s,
          messages: [...s.messages, userMsg, assistantMsg],
        }
        if (autoTitle) updated.title = autoTitle
        historyMessages = [...s.messages, userMsg]
        return updated
      })
      return { ...prev, sessions }
    })

    setLoading(true)
    abortRef.current = false

    const model = activeSession.model || MODELS[0]
    const persona = getPersona()
    const sessionId = activeSession.id

    try {
      await streamChat(
        {
          sessionId,
          messages: historyMessages.map(({ role, content }) => ({ role, content })),
          model,
          ...(persona ? { systemPrompt: persona } : {}),
        },
        (event) => {
          if (abortRef.current) return
          if (event.type === "text") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== prev.activeId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: last.content + event.delta }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
          } else if (event.type === "tool") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== prev.activeId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, toolNames: [...(last.toolNames || []), event.name] }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
          } else if (event.type === "error") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== prev.activeId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: `Error: ${event.message}`, error: true }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
          }
        }
      )
    } catch (err) {
      _set(prev => {
        const sessions = prev.sessions.map(s => {
          if (s.id !== prev.activeId) return s
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: `Error: ${err.message}`, error: true }
          }
          return { ...s, messages: msgs }
        })
        return { ...prev, sessions }
      })
    } finally {
      setLoading(false)
    }
  }, [loading, activeSession])

  const copyMessage = useCallback((content) => {
    navigator.clipboard.writeText(content).catch(() => {})
  }, [])

  const exportSession = useCallback((id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const lines = [`# ${session.title}`, `*${new Date(session.createdAt).toLocaleString()}*`, ""]
    session.messages.forEach(m => {
      lines.push(`**${m.role === "user" ? "You" : "Agent"}:** ${m.content}`, "")
    })
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${session.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [sessions])

  async function _runRefinement(sessionsToAnalyze) {
    const currentPersona = getPersona()
    const summaries = sessionsToAnalyze
      .filter(s => s.messages.length > 0)
      .map(s => {
        const msgs = s.messages
          .map(m => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
          .join("\n")
        return `Session "${s.title}":\n${msgs}`
      })
      .join("\n\n---\n\n")

    if (!summaries) return

    const prompt = `You are updating a trading assistant's persona prompt based on observed user behavior.

Current persona (may be empty):
${currentPersona || "(none)"}

Recent sessions:
${summaries}

Write a concise 2-4 sentence persona prompt in second person ("The user...") describing:
- Their trading instruments of focus (SPX, SPY, QQQ, etc.)
- Their most common question types (gamma flip, key levels, 0DTE, etc.)
- Their preferred response style (brief data, detailed analysis, etc.)

Output ONLY the persona text, no preamble.`

    let refined = ""
    await streamChat(
      {
        sessionId: "persona-refinement-" + genId(),
        messages: [{ role: "user", content: prompt }],
        model: MODELS[0],
      },
      (event) => {
        if (event.type === "text") refined += event.delta
      }
    )
    if (refined.trim()) savePersona(refined.trim())
  }

  const refinePersona = useCallback(async () => {
    const last5 = [...sessions]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .filter(s => s.messages.length > 0)
    await _runRefinement(last5)
  }, [sessions])

  // Sort sessions newest first for display
  const sortedSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt)

  return {
    sessions: sortedSessions,
    activeId,
    activeSession,
    setActiveId,
    newSession,
    renameSession,
    deleteSession,
    setSessionModel,
    sendMessage,
    loading,
    copyMessage,
    exportSession,
    refinePersona,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useAISessions.js
git commit -m "feat: add useAISessions hook with multi-session, streaming, and persona refinement"
```

---

## Task 3: Create `AgentSidebar` component

**Files:**
- Create: `frontend/src/components/ai/AgentSidebar.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from "react"
import { Plus, Pencil, Trash2, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

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
  return (
    <div className="flex flex-col w-60 shrink-0 border-r border-[var(--border)] bg-[var(--surface-1)] overflow-hidden">
      <div className="p-3 border-b border-[var(--border)] shrink-0">
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 rounded-sm",
            "font-mono text-[10px] uppercase tracking-wider",
            "border border-[var(--border)] text-[var(--text-2)]",
            "hover:border-[var(--blue)] hover:text-[var(--text-1)] transition-colors"
          )}
        >
          <Plus size={12} /> New Chat
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ai/AgentSidebar.jsx
git commit -m "feat: add AgentSidebar component with session list, rename, delete"
```

---

## Task 4: Create `AgentChat` component

**Files:**
- Create: `frontend/src/components/ai/AgentChat.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useEffect, useRef } from "react"
import { Download, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage } from "./ChatMessage"
import { ChatInput } from "./ChatInput"
import { getAllModels } from "@/lib/chatSettings"

const SUGGESTED = [
  "SPX gamma flip?",
  "QQQ put wall?",
  "SPY 0DTE pin risk?",
  "SPX key levels today?",
]

export function AgentChat({ session, loading, onSend, onExport, onModelChange, onCopyMessage }) {
  const scrollRef = useRef(null)
  const allModels = getAllModels()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [session?.messages])

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-3)] font-mono text-[11px]">
        No session selected
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] shrink-0 gap-3">
        <span className="font-mono text-[11px] text-[var(--text-1)] truncate font-semibold">
          {session.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {/* Model picker */}
          <div className="relative flex items-center">
            <select
              value={session.model}
              onChange={e => onModelChange(session.id, e.target.value)}
              className={cn(
                "appearance-none font-mono text-[9px] uppercase tracking-wider pr-5 pl-2 py-1",
                "bg-[var(--surface-2)] border border-[var(--border)] rounded-sm",
                "text-[var(--text-2)] focus:outline-none focus:border-[var(--blue)] cursor-pointer"
              )}
            >
              {allModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 pointer-events-none text-[var(--text-3)]" />
          </div>
          {/* Export */}
          <button
            onClick={() => onExport(session.id)}
            className="p-1.5 text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
            title="Export session as markdown"
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0">
        {session.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-3)] text-center">
              Ask about GEX, key levels, volatility, and more
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED.map(s => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className={cn(
                    "font-mono text-[10px] px-2.5 py-1.5 rounded-sm",
                    "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
                    "hover:border-[var(--blue)] hover:text-[var(--text-1)] transition-colors"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          session.messages.map((msg, i) => (
            <ChatMessage
              key={msg.id || i}
              message={msg}
              isStreaming={loading && i === session.messages.length - 1 && msg.role === "assistant"}
              onCopy={onCopyMessage}
            />
          ))
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ai/AgentChat.jsx
git commit -m "feat: add AgentChat component with model picker, messages, export"
```

---

## Task 5: Update `ChatMessage` to add copy button

**Files:**
- Modify: `frontend/src/components/ai/ChatMessage.jsx`

- [ ] **Step 1: Replace file contents**

```jsx
import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function ChatMessage({ message, isStreaming, onCopy }) {
  const isUser = message.role === "user"
  const isEmpty = !message.content && !isStreaming
  const toolNames = message.toolNames || []
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (onCopy) onCopy(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn("group flex flex-col gap-1 mb-3", isUser ? "items-end" : "items-start")}>
      <div className="relative">
        <div
          className={cn(
            "max-w-[85%] rounded-sm px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)]"
              : "bg-[var(--bg)] text-[var(--text-1)] border border-[var(--border)]",
            message.error && "border-red-500/50 text-red-400"
          )}
        >
          {message.content || (isStreaming ? "" : <span className="text-[var(--text-3)]">…</span>)}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-[var(--blue)] ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {!isUser && message.content && onCopy && (
          <button
            onClick={handleCopy}
            className={cn(
              "absolute -top-2 -right-2 hidden group-hover:flex",
              "items-center justify-center w-6 h-6 rounded-sm",
              "bg-[var(--surface-2)] border border-[var(--border)]",
              "text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
            )}
            title="Copy"
          >
            {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          </button>
        )}
      </div>
      {toolNames.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {[...new Set(toolNames)].map((name) => (
            <span
              key={name}
              className="font-mono text-[9px] text-[var(--text-3)] bg-[var(--surface-2)] border border-[var(--border)] rounded-sm px-1.5 py-0.5"
            >
              ⛁ {name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ai/ChatMessage.jsx
git commit -m "feat: add clipboard copy button to assistant messages"
```

---

## Task 6: Create `AgentView`

**Files:**
- Create: `frontend/src/views/AgentView.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useAISessions } from "@/hooks/useAISessions"
import { AgentSidebar } from "@/components/ai/AgentSidebar"
import { AgentChat } from "@/components/ai/AgentChat"

export default function AgentView() {
  const {
    sessions,
    activeId,
    activeSession,
    setActiveId,
    newSession,
    renameSession,
    deleteSession,
    setSessionModel,
    sendMessage,
    loading,
    copyMessage,
    exportSession,
  } = useAISessions()

  return (
    <div className="flex h-full overflow-hidden">
      <AgentSidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={newSession}
        onRename={renameSession}
        onDelete={deleteSession}
      />
      <AgentChat
        session={activeSession}
        loading={loading}
        onSend={sendMessage}
        onExport={exportSession}
        onModelChange={setSessionModel}
        onCopyMessage={copyMessage}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/AgentView.jsx
git commit -m "feat: add AgentView two-pane layout"
```

---

## Task 7: Wire routing, nav link, and remove bubble

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/shell/Sidebar.jsx`
- Modify: `frontend/src/components/shell/AppShell.jsx`
- Delete: `frontend/src/hooks/useAIChat.js`
- Delete: `frontend/src/components/ai/ChatWidget.jsx`

- [ ] **Step 1: Add `/agent` route in `App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AppShell from "@/components/shell/AppShell"
import B3Mode from "@/views/B3Mode"
import WatchlistMode from "@/views/WatchlistMode"
import ExpiryMode from "@/views/ExpiryMode"
import Settings from "@/views/Settings"
import UOAMode from "@/views/UOAMode"
import AgentView from "@/views/AgentView"

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/b3" element={<B3Mode />} />
          <Route path="/watch" element={<WatchlistMode />} />
          <Route path="/expiry" element={<ExpiryMode />} />
          <Route path="/uoa" element={<UOAMode />} />
          <Route path="/agent" element={<AgentView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/b3" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Add Agent nav link in `Sidebar.jsx`**

In `NAV_ITEMS`, add the Agent entry before Settings. Import `BotMessageSquare` from lucide-react:

```jsx
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Star,
  CalendarRange,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Flame,
  BotMessageSquare,
} from "lucide-react";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/b3", icon: LayoutGrid, label: "B3 Mode" },
  { to: "/watch", icon: Star, label: "Flow List" },
  { to: "/expiry", icon: CalendarRange, label: "Gamma Horizon" },
  { to: "/uoa", icon: Flame, label: "Flow Signals" },
  { to: "/agent", icon: BotMessageSquare, label: "Agent" },
  { to: "/settings", icon: Settings2, label: "Settings" },
];
// ... rest of Sidebar unchanged
```

- [ ] **Step 3: Remove `<ChatWidget />` from `AppShell.jsx`**

```jsx
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"

export default function AppShell({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Delete the old hook and widget**

```bash
rm frontend/src/hooks/useAIChat.js
rm frontend/src/components/ai/ChatWidget.jsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/shell/Sidebar.jsx frontend/src/components/shell/AppShell.jsx
git commit -m "feat: add /agent route, nav link, remove floating ChatWidget"
```

---

## Task 8: Update `Settings.jsx` — Agent Models section and Refine button

**Files:**
- Modify: `frontend/src/views/Settings.jsx`

- [ ] **Step 1: Replace the `AIModelInput` component and its section with `AgentModelsSection`**

Remove the old `AIModelInput` function and its import of `getChatModel`/`setChatModel`. Replace the entire "AI Assistant" section with:

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/views/Settings.jsx
git commit -m "feat: replace AIModelInput with AgentModelsSection and Refine Agent button in Settings"
```

---

## Task 9: Smoke test end-to-end

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Navigate to `/agent` and verify**

- Session sidebar appears on the left with one "New Chat" session
- Click "New Chat" — new session appears at top of list
- Type a message and send — auto-title updates from first message
- Response streams in with cursor animation
- Copy button appears on hover over assistant messages
- Model dropdown in header shows all 5 predefined models; selecting one persists on session switch
- Export button downloads a `.md` file

- [ ] **Step 3: Verify session management**

- Rename: hover session row → pencil icon → edit → Enter saves
- Delete: hover session row → trash icon → session removed
- Switching sessions: click different session in sidebar — chat pane switches content

- [ ] **Step 4: Verify Settings page**

- Navigate to `/settings`
- "Agent Models" section shows 5 built-in models
- Add a custom model string → appears in list and in the `/agent` model dropdown
- Delete custom model → removed from both places
- "Refine Agent Now" button shows "Refining…" state then "Refined ✓"

- [ ] **Step 5: Verify bubble is gone**

- Navigate to `/b3`, `/watch`, `/expiry`, `/uoa` — no floating ✦ button visible

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: AgentView complete — multi-session chat, model selection, self-improvement persona"
```
