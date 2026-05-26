import SignalRow from "./SignalRow"

export default function SignalTape({ signals, onSelect, activeSignal }) {
  if (!signals || signals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-[var(--text-3)]">
        No signals match — lower minScore or widen window.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {signals.map((signal, i) => (
        <SignalRow
          key={`${signal.ts}-${signal.strike}-${signal.right}-${i}`}
          signal={signal}
          onClick={onSelect}
          isActive={activeSignal && signal.ts === activeSignal.ts && signal.strike === activeSignal.strike}
        />
      ))}
    </div>
  )
}
