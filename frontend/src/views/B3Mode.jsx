import { useState } from "react"
import InstrumentColumn from "@/components/InstrumentColumn"
import LoadingSkeleton from "@/components/LoadingSkeleton"
import IntradayChart from "@/components/IntradayChart"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const LEGEND = [
  { color: "bg-green opacity-85", label: "Positive net GEX" },
  { color: "bg-red opacity-85", label: "Negative net GEX" },
  { color: "bg-green opacity-20", label: "Gross call GEX" },
  { color: "bg-red opacity-20", label: "Gross put GEX" },
  { color: "bg-amber opacity-60", label: "Spot price" },
  { color: "bg-blue opacity-60", label: "Gamma flip" },
]

export default function B3Mode({ gexData }) {
  const { data, loading, error, REFRESH_INTERVAL } = gexData ?? {}
  const [activeSymbol, setActiveSymbol] = useState(null)

  const instruments = data?.instruments ?? []
  const activeInst = instruments.find(i => i.symbol === (activeSymbol ?? instruments[0]?.symbol))

  return (
    <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 pb-16">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap mb-4 pb-3 border-b border-[var(--border)]">
        <span className="font-mono text-[8px] uppercase tracking-widest text-[var(--text-3)]">Legend</span>
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={cn("w-3.5 h-1.5 rounded-sm", color)} />
            <span className="font-mono text-[8px] text-[var(--text-2)]">{label}</span>
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="mx-auto max-w-md my-6 rounded-lg border border-red/25 bg-red/5 p-4">
          <p className="font-mono text-xs font-semibold text-red mb-1">⚠ API Error</p>
          <p className="font-mono text-[10px] text-red/80">{error}</p>
          <p className="font-mono text-[9px] text-[var(--text-3)] mt-2">
            Ensure backend is running: <code>uv run uvicorn backend.main:app --reload --port 8000</code>
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && <LoadingSkeleton />}

      {data && (
        <>
          {/* Mobile: tabbed symbol selector */}
          <div className="block lg:hidden mb-4">
            <Tabs
              value={activeSymbol ?? instruments[0]?.symbol}
              onValueChange={setActiveSymbol}
            >
              <TabsList>
                {instruments.map(i => (
                  <TabsTrigger key={i.symbol} value={i.symbol}>{i.symbol}</TabsTrigger>
                ))}
              </TabsList>
              {instruments.map(i => (
                <TabsContent key={i.symbol} value={i.symbol}>
                  <InstrumentColumn inst={i} />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Desktop: 3-column grid */}
          <div className={cn(
            "hidden lg:grid gap-4 items-start grid-cols-3",
            loading && "opacity-50 transition-opacity duration-200"
          )}>
            {instruments.map((inst, i) => (
              <div key={inst.symbol} style={{ animationDelay: `${i * 80}ms` }}>
                <InstrumentColumn inst={inst} />
              </div>
            ))}
          </div>

          {/* sm/md: 2-column grid */}
          <div className={cn(
            "hidden sm:grid lg:hidden gap-4 items-start grid-cols-2",
            loading && "opacity-50"
          )}>
            {instruments.map((inst, i) => (
              <div key={inst.symbol} style={{ animationDelay: `${i * 80}ms` }}>
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
                        (activeSymbol ?? instruments[0]?.symbol) === i.symbol
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
        </>
      )}

      {/* Footer */}
      <div className="mt-10 pt-3 border-t border-[var(--border-soft)] flex flex-col sm:flex-row sm:justify-between gap-1">
        <span className="font-mono text-[8px] text-[var(--text-3)]">
          GEX Dashboard v2.0 · FastAPI + React · auto-refresh every {REFRESH_INTERVAL}s
        </span>
        <span className="font-mono text-[8px] text-[var(--text-3)]">
          Informational only · not financial advice
        </span>
      </div>
    </div>
  )
}
