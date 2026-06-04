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
