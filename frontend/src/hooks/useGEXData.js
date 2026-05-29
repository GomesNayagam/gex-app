import { useState, useEffect, useRef, useCallback } from "react";
import { fetchAllGEX } from "@/api";

const REFRESH_INTERVAL = 60

export function useGEXData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef(null);
  const tickRef = useRef(null);
  const pausedRef = useRef(false);

  const load = useCallback(async () => {
    if (pausedRef.current) return;
    setLoading(true);
    setError(null);
    setElapsed(0);
    setRefreshKey((k) => k + 1);
    try {
      const json = await fetchAllGEX();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const startIntervals = useCallback(() => {
    clearInterval(intervalRef.current);
    clearInterval(tickRef.current);
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000);
    tickRef.current = setInterval(
      () => { if (!pausedRef.current) setElapsed((e) => Math.min(e + 1, REFRESH_INTERVAL)); },
      1000,
    );
  }, [load]);

  useEffect(() => {
    load();
    startIntervals();
    return () => {
      clearInterval(intervalRef.current);
      clearInterval(tickRef.current);
    };
  }, [load, startIntervals]);

  const refresh = useCallback(() => {
    if (pausedRef.current) return;
    clearInterval(intervalRef.current);
    clearInterval(tickRef.current);
    load();
    startIntervals();
  }, [load, startIntervals]);

  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const next = !prev;
      pausedRef.current = next;
      if (next) {
        clearInterval(intervalRef.current);
        clearInterval(tickRef.current);
      } else {
        load();
        startIntervals();
      }
      return next;
    });
  }, [load, startIntervals]);

  const bumpRefreshKey = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    data,
    loading,
    error,
    elapsed,
    refresh,
    bumpRefreshKey,
    REFRESH_INTERVAL,
    refreshKey,
    paused,
    togglePause,
  };
}
