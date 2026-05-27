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
    <>
      <div
        className="shrink-0 grid font-mono uppercase tracking-widest"
        style={{
          gridTemplateColumns: "52px 64px 1fr 150px 110px",
          padding: "4px 12px",
          background: "#111118",
          borderBottom: "1px solid #1e1e2a",
          fontSize: "9px",
          color: "#3d3d50",
        }}
      >
        <div>SCORE</div>
        <div>TIME</div>
        <div>CONTRACT</div>
        <div>FLOW</div>
        <div>BREAKDOWN</div>
      </div>
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
    </>
  )
}
