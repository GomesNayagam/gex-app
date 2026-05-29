import { useState } from "react"
import { useFlowSignals } from "@/hooks/useFlowSignals"
import { useLeaderboard } from "@/hooks/useLeaderboard"
import UOATopBar from "@/components/uoa/UOATopBar"
import UOAWatchlistRow from "@/components/uoa/UOAWatchlistRow"
import UOATabsRow from "@/components/uoa/UOATabsRow"
import UOASummaryStrip from "@/components/uoa/UOASummaryStrip"
import UOALeaderboard from "@/components/uoa/UOALeaderboard"
import SignalTape from "@/components/uoa/SignalTape"
import SignalDetailDrawer from "@/components/uoa/SignalDetailDrawer"

export default function UOAMode() {
  const {
    allData,
    activeSymbol,
    setActiveSymbol,
    watchlist,
    addSymbol,
    removeSymbol,
    elapsed,
    refresh,
    filters,
    setFilters,
    REFRESH_INTERVAL,
    paused,
    togglePause,
  } = useFlowSignals()

  const {
    data: lbData,
    loading: lbLoading,
    error: lbError,
    excludeList: lbExclude,
    addExclude: lbAddExclude,
    removeExclude: lbRemoveExclude,
  } = useLeaderboard()

  const handleLeaderboardActivate = (sym) => {
    if (!watchlist.includes(sym)) addSymbol(sym)
    setActiveSymbol(sym)
  }

  const [activeSignal, setActiveSignal] = useState(null)

  const entry = allData[activeSymbol] ?? {}
  const { signals: signalsData, summary, loading, error } = entry

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <UOALeaderboard
        data={lbData}
        loading={lbLoading}
        error={lbError}
        watchlist={watchlist}
        onActivate={handleLeaderboardActivate}
        excludeList={lbExclude}
        onAddExclude={lbAddExclude}
        onRemoveExclude={lbRemoveExclude}
      />

      <UOATopBar
        filters={filters}
        setFilters={setFilters}
        refresh={refresh}
        elapsed={elapsed}
        REFRESH_INTERVAL={REFRESH_INTERVAL}
        paused={paused}
        togglePause={togglePause}
      />

      <UOAWatchlistRow
        watchlist={watchlist}
        activeSymbol={activeSymbol}
        onSelect={setActiveSymbol}
        onAdd={addSymbol}
        onRemove={removeSymbol}
      />

      <UOATabsRow
        watchlist={watchlist}
        activeSymbol={activeSymbol}
        allData={allData}
        onSelect={setActiveSymbol}
      />

      {summary && (
        <UOASummaryStrip
          summary={summary}
          spot={signalsData?.underlying_price}
        />
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {loading && !signalsData && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-[var(--text-3)]">
            Loading flow signals…
          </div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-red-400">
            Error: {error}
          </div>
        )}

        {signalsData && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SignalTape
              signals={signalsData.signals}
              onSelect={setActiveSignal}
              activeSignal={activeSignal}
            />
          </div>
        )}

        {activeSignal && (
          <SignalDetailDrawer
            signal={activeSignal}
            symbol={activeSymbol}
            chain={signalsData?.chain}
            onClose={() => setActiveSignal(null)}
          />
        )}
      </div>
    </div>
  )
}
