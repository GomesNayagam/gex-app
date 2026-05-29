import { useState, useEffect, useRef, useCallback } from "react";
import { fetchFlowSignals, fetchFlowSummary } from "@/api";
import { getRefreshInterval } from "@/lib/refreshSettings";
const LS_FILTERS = "uoa-filters";
const LS_WATCHLIST = "uoa-watchlist";
const LS_ACTIVE = "uoa-active-symbol";

const DEFAULT_WATCHLIST = ["SPX", "SPY", "QQQ"];

const DEFAULT_FILTERS = {
  windowMinutes: 240,
  minScore: 60,
  intent: null,
  structure: null,
  expiry: null,
  zeroDte: false,
};

function loadFilters() {
  try {
    const saved = localStorage.getItem(LS_FILTERS);
    return saved
      ? { ...DEFAULT_FILTERS, ...JSON.parse(saved) }
      : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function loadWatchlist() {
  try {
    const saved = localStorage.getItem(LS_WATCHLIST);
    return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

function loadActiveSymbol(watchlist) {
  try {
    const saved = localStorage.getItem(LS_ACTIVE);
    return saved && watchlist.includes(saved) ? saved : watchlist[0];
  } catch {
    return watchlist[0];
  }
}

export function useFlowSignals() {
  const [REFRESH_INTERVAL] = useState(() => getRefreshInterval("uoaSignals"));
  const [filters, setFiltersState] = useState(loadFilters);
  const [watchlist, setWatchlistState] = useState(loadWatchlist);
  const [activeSymbol, setActiveSymbolState] = useState(() =>
    loadActiveSymbol(loadWatchlist()),
  );
  // allData: { [symbol]: { signals: FlowSignalsResponse|null, summary: FlowSignalsSummary|null, loading: bool, error: string|null } }
  const [allData, setAllData] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const pausedRef = useRef(false);
  const filtersRef = useRef(filters);
  const watchlistRef = useRef(watchlist);
  filtersRef.current = filters;
  watchlistRef.current = watchlist;

  const setFilters = useCallback((update) => {
    setFiltersState((prev) => {
      const next = {
        ...prev,
        ...(typeof update === "function" ? update(prev) : update),
      };
      try {
        localStorage.setItem(LS_FILTERS, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const setActiveSymbol = useCallback((sym) => {
    setActiveSymbolState(sym);
    try {
      localStorage.setItem(LS_ACTIVE, sym);
    } catch {}
  }, []);

  const addSymbol = useCallback(
    (sym) => {
      const upper = sym.trim().toUpperCase();
      if (!upper) return;
      setWatchlistState((prev) => {
        if (prev.includes(upper)) return prev;
        const next = [...prev, upper];
        try {
          localStorage.setItem(LS_WATCHLIST, JSON.stringify(next));
        } catch {}
        return next;
      });
      setActiveSymbol(upper);
    },
    [setActiveSymbol],
  );

  const removeSymbol = useCallback((sym) => {
    setWatchlistState((prev) => {
      const next = prev.filter((s) => s !== sym);
      try {
        localStorage.setItem(LS_WATCHLIST, JSON.stringify(next));
      } catch {}
      setActiveSymbolState((active) => {
        if (active === sym) {
          const fallback = next[0] ?? "";
          try {
            localStorage.setItem(LS_ACTIVE, fallback);
          } catch {}
          return fallback;
        }
        return active;
      });
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (pausedRef.current) return;
    const f = filtersRef.current;
    const syms = watchlistRef.current;
    if (!syms.length) return;

    const expiry = f.zeroDte ? getTodayOrNextWeekday() : f.expiry;
    setElapsed(0);

    // Mark all as loading
    setAllData((prev) => {
      const next = { ...prev };
      syms.forEach((s) => {
        next[s] = { ...(prev[s] || {}), loading: true, error: null };
      });
      return next;
    });

    const results = await Promise.allSettled(
      syms.map(async (sym) => {
        const [signalsData, summaryData] = await Promise.all([
          fetchFlowSignals(sym, {
            windowMinutes: f.windowMinutes,
            minScore: f.minScore,
            intent: f.intent,
            structure: f.structure,
            expiry,
          }),
          fetchFlowSummary(sym, { windowMinutes: f.windowMinutes, expiry }),
        ]);
        return { sym, signalsData, summaryData };
      }),
    );

    setAllData((prev) => {
      const next = { ...prev };
      syms.forEach((sym, idx) => {
        const result = results[idx];
        if (result.status === "fulfilled") {
          const { signalsData, summaryData } = result.value;
          next[sym] = {
            signals: signalsData,
            summary: summaryData,
            loading: false,
            error: null,
          };
        } else {
          next[sym] = {
            ...(prev[sym] || {}),
            loading: false,
            error: result.reason?.message ?? "Error",
          };
        }
      });
      return next;
    });
  }, []);

  const startPolling = useCallback(() => {
    clearInterval(intervalRef.current);
    clearInterval(tickRef.current);
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000);
    tickRef.current = setInterval(
      () => { if (!pausedRef.current) setElapsed((e) => Math.min(e + 1, REFRESH_INTERVAL)); },
      1000,
    );
  }, [load]);

  const refresh = useCallback(() => {
    if (pausedRef.current) return;
    load();
    startPolling();
  }, [load, startPolling]);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      if (next) {
        clearInterval(intervalRef.current);
        clearInterval(tickRef.current);
      } else {
        load();
        startPolling();
      }
      return next;
    });
  }, [load, startPolling]);

  useEffect(() => {
    load();
    startPolling();
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.windowMinutes,
    filters.minScore,
    filters.intent,
    filters.structure,
    filters.expiry,
    filters.zeroDte,
    watchlist,
  ]);

  return {
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
  };
}

function getTodayOrNextWeekday() {
  const today = new Date();
  const dow = today.getDay();
  if (dow === 0) {
    const d = new Date(today);
    d.setDate(today.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (dow === 6) {
    const d = new Date(today);
    d.setDate(today.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}
