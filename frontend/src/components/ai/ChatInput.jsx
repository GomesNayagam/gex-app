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
    <div className="px-6 py-3">
      <div className="flex items-end gap-2 max-w-3xl mx-auto w-full">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder="Ask about GEX, levels, vol…"
        className={cn(
          "flex-1 resize-none rounded-2xl glass-input",
          "px-3 py-2 font-mono text-[13px] text-[var(--text-1)] placeholder:text-[var(--text-3)]",
          "max-h-[120px] overflow-y-auto",
          "disabled:opacity-50"
        )}
        style={{ height: "72px", minHeight: "72px" }}
        onInput={(e) => {
          e.target.style.height = "auto"
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
        }}
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-full shrink-0",
          "bg-[rgba(110,231,199,0.14)] text-[var(--mint)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.35)] font-mono text-[13px]",
          "disabled:opacity-40 hover:bg-[rgba(110,231,199,0.22)] transition-colors"
        )}
        aria-label="Send"
      >
        →
      </button>
      </div>
    </div>
  )
}
