import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useAIChat } from "@/hooks/useAIChat"
import { ChatMessage } from "./ChatMessage"
import { ChatInput } from "./ChatInput"

const SUGGESTED = [
  "SPX gamma flip?",
  "QQQ put wall?",
  "SPY 0DTE pin risk?",
  "SPX key levels today?",
]

export function ChatWidget() {
  const { open, setOpen, messages, loading, sendMessage, clear } = useAIChat()
  const scrollRef = useRef(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full",
          "bg-[var(--blue)] text-white shadow-lg flex items-center justify-center",
          "hover:opacity-90 transition-opacity text-lg",
          open && "hidden"
        )}
        aria-label="Open AI assistant"
        title="Ask FlashAlpha"
      >
        ✦
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-5 right-5 z-50 flex flex-col",
          "w-[380px] max-w-[calc(100vw-2.5rem)]",
          "h-[520px] max-h-[calc(100vh-5rem)]",
          "bg-[var(--surface-1)] border border-[var(--border)] rounded-sm shadow-2xl",
          "transition-all duration-200",
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        )}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] shrink-0">
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-1)] flex items-center gap-1.5">
            <span className="text-[var(--blue)]">✦</span> Ask FlashAlpha
          </span>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors"
                title="Clear history"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors text-base leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-3)] text-center">
                Ask about GEX, key levels, volatility, and more
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
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
            messages.map((msg, i) => (
              <ChatMessage
                key={msg.id || i}
                message={msg}
                isStreaming={loading && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))
          )}
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={loading} />
      </div>
    </>
  )
}
