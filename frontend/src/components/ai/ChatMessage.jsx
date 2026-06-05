import { useState } from "react"
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

const mdComponents = {
  h1: ({ children }) => <p className="font-semibold text-[12px] text-[var(--text-1)] mt-2 mb-1">{children}</p>,
  h2: ({ children }) => <p className="font-semibold text-[11px] text-[var(--text-1)] mt-2 mb-1">{children}</p>,
  h3: ({ children }) => <p className="font-semibold text-[11px] text-[var(--text-2)] mt-1 mb-0.5">{children}</p>,
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-1)]">{children}</strong>,
  em: ({ children }) => <em className="text-[var(--text-2)]">{children}</em>,
  hr: () => <hr className="border-[var(--border)] my-2" />,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-1.5 pl-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1">{children}</ol>,
  li: ({ children }) => <li className="text-[var(--text-1)]">{children}</li>,
  code: ({ inline, children }) => inline
    ? <code className="bg-[var(--surface-3)] text-[var(--blue)] px-1 rounded-sm text-[10px]">{children}</code>
    : <pre className="bg-[var(--surface-3)] border border-[var(--border)] rounded-sm p-2 overflow-x-auto text-[10px] my-1.5"><code>{children}</code></pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-1.5">
      <table className="w-full text-[10px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[var(--border)]">{children}</tr>,
  th: ({ children }) => <th className="text-left px-2 py-1 text-[var(--text-2)] font-semibold border border-[var(--border)] bg-[var(--surface-2)]">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 border border-[var(--border)] text-[var(--text-1)]">{children}</td>,
}

export function ChatMessage({ message, isStreaming, onCopy, onFeedback }) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (onCopy) onCopy(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const showActions = !isUser && message.content && !isStreaming

  return (
    <div className={cn("group flex flex-col gap-1 py-4", isUser ? "items-end" : "items-start")}>
      <div className="max-w-[88%]">
        <div
          className={cn(
            "rounded-sm px-3 py-2.5 font-mono text-[11px] leading-relaxed break-words",
            isUser
              ? "bg-[var(--blue-dim)] text-[var(--text-1)] border border-[var(--blue)]/30 ml-8"
              : "bg-[var(--surface-2)] text-[var(--text-1)] border border-[var(--border)]",
            message.error && "border-red-500/50 text-red-400"
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          ) : isStreaming ? null : (
            <span className="text-[var(--text-3)]">…</span>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-[var(--blue)] ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>

      {/* Action row: Good / Bad / Copy — below assistant messages only */}
      {showActions && (
        <div className="flex items-center gap-1 mt-1 px-0.5">
          {onFeedback && (
            <>
              <button
                onClick={() => onFeedback(message.id, message.feedback === "positive" ? null : "positive")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-colors",
                  message.feedback === "positive"
                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                    : "border-[var(--border)] text-[var(--text-3)] hover:border-green-500/50 hover:text-green-400"
                )}
                title="Good response"
              >
                <ThumbsUp size={10} />
              </button>
              <button
                onClick={() => onFeedback(message.id, message.feedback === "negative" ? null : "negative")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-colors",
                  message.feedback === "negative"
                    ? "border-red-500/50 text-red-400 bg-red-500/10"
                    : "border-[var(--border)] text-[var(--text-3)] hover:border-red-500/50 hover:text-red-400"
                )}
                title="Bad response"
              >
                <ThumbsDown size={10} />
              </button>
            </>
          )}
          {onCopy && (
            <button
              onClick={handleCopy}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-colors",
                copied
                  ? "border-[var(--blue)]/50 text-[var(--blue)] bg-[var(--blue-dim)]"
                  : "border-[var(--border)] text-[var(--text-3)] hover:border-[var(--blue)]/50 hover:text-[var(--text-1)]"
              )}
              title="Copy"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
