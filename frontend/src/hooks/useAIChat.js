import { useState, useCallback, useRef } from "react"
import { streamChat } from "@/api"
import { getChatModel } from "@/lib/chatSettings"

function genId() {
  return Math.random().toString(36).slice(2)
}

function loadPersisted() {
  try {
    const msgs = JSON.parse(localStorage.getItem("ai-chat-messages") || "null")
    const sid = localStorage.getItem("ai-chat-session") || genId()
    return { messages: Array.isArray(msgs) ? msgs : [], sessionId: sid }
  } catch {
    return { messages: [], sessionId: genId() }
  }
}

function persist(messages, sessionId) {
  try {
    localStorage.setItem("ai-chat-messages", JSON.stringify(messages))
    localStorage.setItem("ai-chat-session", sessionId)
  } catch {}
}

export function useAIChat() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [{ messages, sessionId }, setState] = useState(loadPersisted)
  const abortRef = useRef(false)

  function _setState(updater) {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      persist(next.messages, next.sessionId)
      return next
    })
  }

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return

    const userMsg = { role: "user", content: text.trim(), id: genId() }
    const assistantMsg = { role: "assistant", content: "", id: genId(), toolNames: [] }

    let currentMessages
    _setState((prev) => {
      currentMessages = [...prev.messages, userMsg]
      return { messages: [...currentMessages, assistantMsg], sessionId: prev.sessionId }
    })

    setLoading(true)
    abortRef.current = false

    try {
      const history = currentMessages.map(({ role, content }) => ({ role, content }))
      const model = getChatModel() || undefined

      await streamChat(
        { sessionId, messages: history, model },
        (event) => {
          if (abortRef.current) return
          if (event.type === "text") {
            _setState((prev) => {
              const msgs = [...prev.messages]
              const last = msgs[msgs.length - 1]
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, content: last.content + event.delta }
              }
              return { ...prev, messages: msgs }
            })
          } else if (event.type === "tool") {
            _setState((prev) => {
              const msgs = [...prev.messages]
              const last = msgs[msgs.length - 1]
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...last,
                  toolNames: [...(last.toolNames || []), event.name],
                }
              }
              return { ...prev, messages: msgs }
            })
          } else if (event.type === "error") {
            _setState((prev) => {
              const msgs = [...prev.messages]
              const last = msgs[msgs.length - 1]
              if (last?.role === "assistant") {
                msgs[msgs.length - 1] = { ...last, content: `Error: ${event.message}`, error: true }
              }
              return { ...prev, messages: msgs }
            })
          }
        }
      )
    } catch (err) {
      _setState((prev) => {
        const msgs = [...prev.messages]
        const last = msgs[msgs.length - 1]
        if (last?.role === "assistant") {
          msgs[msgs.length - 1] = { ...last, content: `Error: ${err.message}`, error: true }
        }
        return { ...prev, messages: msgs }
      })
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId])

  const clear = useCallback(() => {
    abortRef.current = true
    const sid = genId()
    _setState({ messages: [], sessionId: sid })
    setLoading(false)
  }, [])

  return { open, setOpen, messages, loading, sendMessage, clear }
}
