import { useState, useEffect, useRef, useCallback } from "react";
import { fetchLeaderboard } from "@/api";

const REFRESH_INTERVAL = 30;
const LS_EXCLUDE = "lb-exclude";
const DEFAULT_EXCLUDE = ["SPX", "SPY", "QQQ"];

function loadExclude() {
  try {
    const saved = localStorage.getItem(LS_EXCLUDE);
    return saved ? JSON.parse(saved) : DEFAULT_EXCLUDE;
  } catch {
    return DEFAULT_EXCLUDE;
  }
}

export function useLeaderboard({ window = 60, n = 5 } = {}) {
  const [excludeList, setExcludeList] = useState(loadExclude);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const excludeRef = useRef(excludeList);
  excludeRef.current = excludeList;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const raw = await fetchLeaderboard({ window, n });
      setRawData(raw);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [window, n]);

  const refresh = useCallback(() => {
    load();
    clearInterval(intervalRef.current);
    clearInterval(tickRef.current);
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000);
    tickRef.current = setInterval(
      () => setElapsed((e) => Math.min(e + 1, REFRESH_INTERVAL)),
      1000,
    );
  }, [load]);

  useEffect(() => {
    refresh();
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
  }, [refresh]);

  const addExclude = useCallback((sym) => {
    const upper = sym.trim().toUpperCase();
    if (!upper) return;
    setExcludeList((prev) => {
      if (prev.includes(upper)) return prev;
      const next = [...prev, upper];
      try { localStorage.setItem(LS_EXCLUDE, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removeExclude = useCallback((sym) => {
    setExcludeList((prev) => {
      const next = prev.filter((s) => s !== sym);
      try { localStorage.setItem(LS_EXCLUDE, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const excludeSet = new Set(excludeList);
  const data = rawData
    ? {
        ...rawData,
        buyers: (rawData.buyers || []).filter((e) => !excludeSet.has(e.symbol)),
        sellers: (rawData.sellers || []).filter((e) => !excludeSet.has(e.symbol)),
      }
    : null;

  return {
    data,
    loading,
    error,
    elapsed,
    refresh,
    REFRESH_INTERVAL,
    excludeList,
    addExclude,
    removeExclude,
  };
}
