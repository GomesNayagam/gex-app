import { useState, useCallback, useRef } from "react"
import { streamChat } from "@/api"
import { getAllModels, getPersona, savePersona, MODELS } from "@/lib/chatSettings"

function genId() {
  return crypto.randomUUID()
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

let _refining = false // module-level flag to prevent concurrent persona refinement

export function useAISessions() {
  const [{ sessions, activeId }, setState] = useState(() => {
    const s = loadState()
    // Ensure there's always at least one session
    if (s.sessions.length === 0) {
      const blank = makeSession()
      persistSessions([blank])
      persistActive(blank.id)
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
      setTimeout(() => { _runRefinement([leaving]).catch(() => {}) }, 0)
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
    const assistantMsg = { role: "assistant", content: "", id: genId(), toolNames: [], subAgents: [] }

    // Auto-title from first message
    const isFirst = activeSession.messages.length === 0
    const autoTitle = isFirst ? text.trim().slice(0, 60) : null

    // Derive history BEFORE _set — React's setState updater can be deferred,
    // so capturing inside the updater risks historyMessages being empty when streamChat is called.
    const historyMessages = [...activeSession.messages, userMsg]

    _set((prev) => {
      const sessions = prev.sessions.map(s => {
        if (s.id !== prev.activeId) return s
        const updated = {
          ...s,
          messages: [...s.messages, userMsg, assistantMsg],
        }
        if (autoTitle) updated.title = autoTitle
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
                if (s.id !== sessionId) return s
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
                if (s.id !== sessionId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, toolNames: [...(last.toolNames || []), event.name] }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
          } else if (event.type === "agent_event") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== sessionId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  const subAgents = [...(last.subAgents || [])]
                  let idx = subAgents.findIndex(a => a.name === event.agent)
                  if (idx === -1) {
                    subAgents.push({ name: event.agent, label: event.agent, status: "running", toolNames: [], summary: "" })
                    idx = subAgents.length - 1
                  }
                  const agentEntry = { ...subAgents[idx] }
                  if (event.kind === "start") {
                    agentEntry.status = "running"
                  } else if (event.kind === "tool") {
                    agentEntry.toolNames = [...agentEntry.toolNames, event.name]
                  } else if (event.kind === "done") {
                    agentEntry.status = "done"
                    agentEntry.summary = event.summary || ""
                  }
                  // "text" deltas are intentionally not accumulated into the trace —
                  // the trace shows tools called + a final summary, not a transcript.
                  subAgents[idx] = agentEntry
                  msgs[msgs.length - 1] = { ...last, subAgents }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
          } else if (event.type === "error") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== sessionId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: "An error occurred. Please try again.", error: true }
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
          if (s.id !== sessionId) return s
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, content: "An error occurred. Please try again.", error: true }
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

  const setMessageFeedback = useCallback((sessionId, messageId, feedback) => {
    _set(prev => ({
      ...prev,
      sessions: prev.sessions.map(s =>
        s.id !== sessionId ? s : {
          ...s,
          messages: s.messages.map(m =>
            m.id !== messageId ? m : { ...m, feedback }
          ),
        }
      ),
    }))
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
    if (_refining) return
    _refining = true
    try {
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

      // Collect rated responses across all sessions
      const liked = sessionsToAnalyze.flatMap(s =>
        s.messages.filter(m => m.role === "assistant" && m.feedback === "positive").map(m => m.content.slice(0, 300))
      )
      const disliked = sessionsToAnalyze.flatMap(s =>
        s.messages.filter(m => m.role === "assistant" && m.feedback === "negative").map(m => m.content.slice(0, 300))
      )

      const feedbackSection = [
        liked.length ? `Responses the user rated POSITIVELY (emulate this style/depth):\n${liked.map(r => `- ${r}`).join("\n")}` : "",
        disliked.length ? `Responses the user rated NEGATIVELY (avoid this style/depth):\n${disliked.map(r => `- ${r}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n")

      const prompt = `You are updating a trading assistant's persona prompt based on observed user behavior.

Current persona (may be empty):
${currentPersona || "(none)"}

Recent sessions:
${summaries}
${feedbackSection ? `\nUser feedback on responses:\n${feedbackSection}` : ""}

Write a concise 2-4 sentence persona prompt in second person ("The user...") describing:
- Their trading instruments of focus (SPX, SPY, QQQ, etc.)
- Their most common question types (gamma flip, key levels, 0DTE, etc.)
- Their preferred response style (brief data, detailed analysis, etc.)
- Any response style preferences inferred from their feedback (if available)

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
    } finally {
      _refining = false
    }
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
    setMessageFeedback,
  }
}
