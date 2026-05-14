import { useState } from "react"
import InstrumentColumn from "@/components/InstrumentColumn"
import LoadingSkeleton from "@/components/LoadingSkeleton"
import IntradayChart from "@/components/IntradayChart"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function B3Mode({ gexData }) {
  const { data, loading, error } = gexData ?? {}
  const [activeSymbol, setActiveSymbol] = useState(null)

  const instruments = data?.instruments ?? []
  const effectiveSymbol = activeSymbol ?? instruments[0]?.symbol
  const activeInst = instruments.find(i => i.symbol === effectiveSymbol)

  if (loading && !data) {
    return <div className="p-4"><LoadingSkeleton /></div>
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red/25 bg-red/5 p-4">
          <p className="font-mono text-xs font-semibold text-red mb-1">API Error</p>
          <p className="font-mono text-[10px] text-red/80">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-4 overflow-y-auto h-full">
      {/* 3-column grid — no horizontal scroll */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
        {instruments.map(inst => (
          <div key={inst.symbol} className="min-w-0">
            <InstrumentColumn inst={inst} />
          </div>
        ))}
      </div>

      {/* Intraday chart section */}
      {activeInst && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-2)]">
              Intraday GEX Evolution
            </span>
            <Badge variant="muted">{activeInst.symbol}</Badge>
            <div className="flex gap-1 ml-auto">
              {instruments.map(i => (
                <button
                  key={i.symbol}
                  onClick={() => setActiveSymbol(i.symbol)}
                  className={cn(
                    "font-mono text-[9px] px-2 py-0.5 rounded border transition-colors",
                    effectiveSymbol === i.symbol
                      ? "border-blue/40 text-blue bg-blue/10"
                      : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]"
                  )}
                >
                  {i.symbol}
                </button>
              ))}
            </div>
          </div>
          <IntradayChart symbol={activeInst.symbol} instrument={activeInst} />
        </div>
      )}
    </div>
  )
}
