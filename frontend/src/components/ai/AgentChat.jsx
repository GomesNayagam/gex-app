import { useEffect, useRef } from "react";
import { Download, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { getAllModels } from "@/lib/chatSettings";

const SUGGESTED = [
  "SPX gamma flip?",
  "QQQ put wall?",
  "SPY 0DTE pin risk?",
  "SPX key levels today?",
  "SPX intraday technicals",
];

export function AgentChat({
  session,
  loading,
  onSend,
  onExport,
  onModelChange,
  onCopyMessage,
  onFeedback,
}) {
  const scrollRef = useRef(null);
  const allModels = getAllModels();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.messages]);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-display text-[17px] text-[var(--slate)]">No session selected</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--edge-soft)] shrink-0 gap-3">
        <span className="font-display text-[15px] text-[var(--ivory)] truncate">
          {session.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {/* Model picker */}
          <div className="relative flex items-center">
            <select
              value={session.model}
              onChange={(e) => onModelChange(session.id, e.target.value)}
              className={cn(
                "appearance-none font-mono text-[9px] uppercase tracking-wider pr-5 pl-2 py-1",
                "bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] rounded-full border-0",
                "text-[var(--text-2)] focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(232,197,116,0.55)] cursor-pointer",
              )}
            >
              {allModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="absolute right-1.5 pointer-events-none text-[var(--text-3)]"
            />
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
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col"
      >
        {session.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-full max-w-3xl mx-auto px-6 flex flex-col items-center gap-3">
              <p className="font-display text-[19px] text-[var(--slate)] text-center">
                Ask about gamma, key levels, and volatility
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    className={cn(
                      "font-mono text-[10px] px-3 py-1.5 rounded-full",
                      "bg-[var(--glass)] text-[var(--slate)] shadow-[inset_0_0_0_1px_var(--edge)]",
                      "hover:text-[var(--ivory)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] transition-colors",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          session.messages.map((msg, i) => {
            const prevUser =
              msg.role === "assistant"
                ? [...session.messages]
                    .slice(0, i)
                    .reverse()
                    .find((m) => m.role === "user")
                : null;
            return (
              <ChatMessage
                key={msg.id || i}
                message={msg}
                isStreaming={
                  loading &&
                  i === session.messages.length - 1 &&
                  msg.role === "assistant"
                }
                onCopy={onCopyMessage}
                onFeedback={onFeedback}
                onRegenerate={
                  prevUser && !loading
                    ? () => onSend(prevUser.content)
                    : undefined
                }
              />
            );
          })
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}
