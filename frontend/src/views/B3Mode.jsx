import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useGEXData } from "@/hooks/useGEXData";
import InstrumentColumn from "@/components/InstrumentColumn";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import IntradayChart from "@/components/IntradayChart";
import { cn } from "@/lib/utils";
import { HeaderActions } from "@/components/shell/HeaderActions";

export default function B3Mode() {
  const { data, loading, error, paused, togglePause } = useGEXData();
  const [activeSymbol, setActiveSymbol] = useState(null);

  const instruments = data?.instruments ?? [];
  const effectiveSymbol = activeSymbol ?? instruments[0]?.symbol;
  const activeInst = instruments.find((i) => i.symbol === effectiveSymbol);

  if (loading && !data) {
    return (
      <div className="p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="glass-panel max-w-md p-5 shadow-[inset_0_0_0_1px_rgba(240,138,155,0.25)]">
          <p className="font-mono text-xs font-semibold text-[var(--rose)] mb-1">
            API Error
          </p>
          <p className="font-mono text-[10px] text-[var(--slate)]">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="p-6 overflow-y-auto h-full">
      <HeaderActions>
        <button
          onClick={togglePause}
          className={cn(
            "flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] px-3.5 py-[5px] rounded-full transition-colors duration-150",
            paused
              ? "text-[var(--gold)] bg-[rgba(232,197,116,0.10)] shadow-[inset_0_0_0_1px_rgba(232,197,116,0.35)]"
              : "text-[var(--slate)] bg-[var(--glass)] shadow-[inset_0_0_0_1px_var(--edge)] hover:text-[var(--ivory)]",
          )}
          title={paused ? "Resume auto-refresh" : "Pause auto-refresh"}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          {paused ? "resume" : "pause"}
        </button>
      </HeaderActions>
      {/* 3-column grid — no horizontal scroll */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px] min-w-0">
        {instruments.map((inst) => (
          <div key={inst.symbol} className="min-w-0">
            <InstrumentColumn inst={inst} resizable />
          </div>
        ))}
      </div>

      {/* Intraday chart section */}
      {activeInst && (
        <div className="mt-3">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <span className="font-display text-[17px] text-[var(--ivory)]">
              Intraday Evolution
            </span>
            <span className="font-mono text-[9px] tracking-[0.1em] text-[var(--slate-dim)]">
              NET GEX · SESSION
            </span>
            <div className="flex gap-1.5 ml-auto">
              {instruments.map((i) => (
                <button
                  key={i.symbol}
                  onClick={() => setActiveSymbol(i.symbol)}
                  className={cn(
                    "font-mono text-[9px] px-2.5 py-[3px] rounded-full transition-colors duration-150",
                    effectiveSymbol === i.symbol
                      ? "text-[var(--mint)] bg-[rgba(110,231,199,0.10)] shadow-[inset_0_0_0_1px_rgba(110,231,199,0.25)]"
                      : "text-[var(--slate-dim)] shadow-[inset_0_0_0_1px_var(--edge-soft)] hover:text-[var(--slate)]",
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
  );
}
