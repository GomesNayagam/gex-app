import { useState, useRef } from "react"
import { cn } from "@/lib/utils"

export function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("")
  const textareaRef = useRef(null)

  function submit() {
    const text = value.trim()
    if (!text || disabled) return
    setValue("")
    onSend(text)
    textareaRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-[var(--border)] p-3 bg-[var(--surface-1)]">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="Ask about GEX, levels, vol…"
        className={cn(
          "flex-1 resize-none rounded-sm border border-[var(--border)] bg-[var(--surface-2)]",
          "px-3 py-2 font-mono text-[11px] text-[var(--text-1)] placeholder:text-[var(--text-3)]",
          "focus:outline-none focus:border-[var(--blue)] max-h-[120px] overflow-y-auto",
          "disabled:opacity-50"
        )}
        style={{ height: "auto", minHeight: "36px" }}
        onInput={(e) => {
          e.target.style.height = "auto"
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-sm shrink-0",
          "bg-[var(--blue)] text-white font-mono text-[13px]",
          "disabled:opacity-40 hover:opacity-80 transition-opacity"
        )}
        aria-label="Send"
      >
        →
      </button>
    </div>
  )
}
