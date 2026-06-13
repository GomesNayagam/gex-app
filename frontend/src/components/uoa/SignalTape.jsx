import SignalRow from "./SignalRow"

export default function SignalTape({ signals, onSelect, activeSignal }) {
  if (!signals || signals.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
        <p className="font-display text-[17px] text-[var(--slate)]">No signals match</p>
        <p className="font-mono text-[9px] tracking-[0.08em] text-[var(--slate-dim)]">LOWER MIN SCORE OR WIDEN THE WINDOW</p>
      </div>
    )
  }

  return (
    <>
      <div
        className="shrink-0 grid font-mono uppercase tracking-widest"
        style={{
          gridTemplateColumns: "52px 64px 1fr 150px 110px",
          padding: "4px 24px",
          background: "rgba(255,255,255,0.015)",
          borderBottom: "1px solid var(--edge-soft)",
          fontSize: "9px",
          color: "var(--slate-dim)",
          letterSpacing: "0.18em",
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
