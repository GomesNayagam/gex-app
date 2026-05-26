import { useState } from "react"
import { useFlowSignals } from "@/hooks/useFlowSignals"
import UOATopBar from "@/components/uoa/UOATopBar"
import UOASummaryStrip from "@/components/uoa/UOASummaryStrip"
import SignalTape from "@/components/uoa/SignalTape"
import SignalDetailDrawer from "@/components/uoa/SignalDetailDrawer"

export default function UOAMode() {
  const { data, summary, loading, error, elapsed, refresh, filters, setFilters, REFRESH_INTERVAL } = useFlowSignals()
  const [activeSignal, setActiveSignal] = useState(null)

  const drawerPinned = activeSignal !== null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <UOATopBar
        filters={filters}
        setFilters={setFilters}
        refresh={refresh}
        elapsed={elapsed}
        REFRESH_INTERVAL={REFRESH_INTERVAL}
      />

      {summary && (
        <UOASummaryStrip
          summary={summary}
          spot={data?.underlying_price}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* Loading / error states */}
        {loading && !data && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-[var(--text-3)]">
            Loading flow signals…
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-red-400">
            Error: {error}
          </div>
        )}

        {data && (
          <div className={`flex-1 flex flex-col overflow-hidden transition-all ${drawerPinned ? "mr-0" : ""}`}>
            <SignalTape
              signals={data.signals}
              onSelect={setActiveSignal}
              activeSignal={activeSignal}
            />
          </div>
        )}

        {activeSignal && (
          <SignalDetailDrawer
            signal={activeSignal}
            chain={data?.chain}
            onClose={() => setActiveSignal(null)}
          />
        )}
      </div>
    </div>
  )
}
