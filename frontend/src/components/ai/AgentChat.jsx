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

export function AgentChat({ session, loading, onSend, onExport, onModelChange, onCopyMessage, onFeedback }) {
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col divide-y divide-[var(--border)]">
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
              onFeedback={onFeedback}
            />
          ))
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  )
}
