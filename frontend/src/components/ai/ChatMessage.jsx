import { useState } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const mdComponents = {
  h1: ({ children }) => (
    <p className="font-semibold text-[15px] text-[var(--text-1)] mt-2 mb-1">
      {children}
    </p>
  ),
  h2: ({ children }) => (
    <p className="font-semibold text-[14px] text-[var(--text-1)] mt-2 mb-1">
      {children}
    </p>
  ),
  h3: ({ children }) => (
    <p className="font-semibold text-[13px] text-[var(--text-2)] mt-1 mb-0.5">
      {children}
    </p>
  ),
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--text-1)]">{children}</strong>
  ),
  em: ({ children }) => <em className="text-[var(--text-2)]">{children}</em>,
  hr: () => <hr className="border-[var(--border)] my-2" />,
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-0.5 mb-1.5 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-0.5 mb-1.5 pl-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-[var(--text-1)]">{children}</li>,
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-[var(--surface-3)] text-[var(--blue)] px-1 rounded-sm text-[12px]">
        {children}
      </code>
    ) : (
      <pre className="bg-[var(--surface-3)] border border-[var(--border)] rounded-sm p-2 overflow-x-auto text-[12px] my-1.5">
        <code>{children}</code>
      </pre>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-1.5">
      <table className="w-full text-[10px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-[var(--border)]">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="text-left px-2 py-1 text-[var(--text-2)] font-semibold border border-[var(--border)] bg-[var(--surface-2)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1 border border-[var(--border)] text-[var(--text-1)]">
      {children}
    </td>
  ),
};

function AgentTrace({ subAgents }) {
  const [open, setOpen] = useState(false);
  if (!subAgents || subAgents.length === 0) return null;

  return (
    <div className="mt-1.5 border border-[var(--border)] rounded-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>Agent trace</span>
        <span className="text-[var(--text-3)]/70 normal-case tracking-normal">
          ({subAgents.filter((a) => a.status === "done").length}/
          {subAgents.length} done)
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {subAgents.map((agent) => (
            <div key={agent.name} className="px-2 py-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                {agent.status === "running" ? (
                  <Loader2
                    size={11}
                    className="animate-spin text-[var(--blue)]"
                  />
                ) : (
                  <span className="w-[11px] h-[11px] rounded-full bg-green-500/60 inline-block" />
                )}
                <span className="text-[var(--text-1)] font-semibold">
                  {agent.label || agent.name}
                </span>
                <span className="text-[var(--text-3)] uppercase tracking-wider text-[9px]">
                  {agent.status === "running" ? "running" : "done"}
                </span>
              </div>
              {agent.toolNames.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {agent.toolNames.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="px-1.5 py-0.5 rounded-sm bg-[var(--surface-3)] text-[var(--text-2)] text-[9px]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {agent.summary && (
                <p className="mt-1 text-[var(--text-2)] leading-snug">
                  {agent.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message, isStreaming, onCopy, onFeedback, onRegenerate }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (onCopy) onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const showActions = !isUser && message.content && !isStreaming;

  return (
    <div
      className={cn(
        "group flex flex-col gap-1 py-4 px-6 max-w-3xl mx-auto w-full",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div className="max-w-[88%]">
        <div
          className={cn(
            "rounded-sm px-3 py-2.5 font-mono leading-relaxed break-words",
            isUser
              ? "bg-[var(--blue-dim)] text-[var(--text-1)] text-[13px] ml-8"
              : "text-[var(--text-1)] text-[13px]",
            message.error && "border-red-500/50 text-red-400",
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : isStreaming ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={mdComponents}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <span className="text-[var(--text-3)]">…</span>
          )}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-[var(--blue)] ml-0.5 animate-pulse align-middle" />
          )}
        </div>
        {!isUser && <AgentTrace subAgents={message.subAgents} />}
      </div>

      {/* Action row: Good / Bad / Copy — below assistant messages only */}
      {showActions && (
        <div className="flex items-center gap-1 mt-1 px-0.5">
          {onFeedback && (
            <>
              <button
                onClick={() =>
                  onFeedback(
                    message.id,
                    message.feedback === "positive" ? null : "positive",
                  )
                }
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-colors",
                  message.feedback === "positive"
                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                    : "border-[var(--border)] text-[var(--text-3)] hover:border-green-500/50 hover:text-green-400",
                )}
                title="Good response"
              >
                <ThumbsUp size={10} />
              </button>
              <button
                onClick={() =>
                  onFeedback(
                    message.id,
                    message.feedback === "negative" ? null : "negative",
                  )
                }
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-colors",
                  message.feedback === "negative"
                    ? "border-red-500/50 text-red-400 bg-red-500/10"
                    : "border-[var(--border)] text-[var(--text-3)] hover:border-red-500/50 hover:text-red-400",
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
                  : "border-[var(--border)] text-[var(--text-3)] hover:border-[var(--blue)]/50 hover:text-[var(--text-1)]",
              )}
              title="Copy"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-1 rounded-sm border border-[var(--border)] text-[9px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:border-[var(--blue)]/50 hover:text-[var(--text-1)] transition-colors"
              title="Regenerate"
            >
              <RotateCcw size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
