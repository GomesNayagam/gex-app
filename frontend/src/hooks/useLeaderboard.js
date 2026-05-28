import { useState, useEffect, useRef, useCallback } from "react";
import { fetchLeaderboard } from "@/api";

const REFRESH_INTERVAL = 30;
const LEADERBOARD_EXCLUDE = new Set(["SPX", "SPY", "QQQ"]);

function filterRows(rows) {
  return (rows || []).filter((e) => !LEADERBOARD_EXCLUDE.has(e.symbol));
}

export function useLeaderboard({ window = 60, n = 5 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const intervalRef = useRef(null);
  const tickRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const raw = await fetchLeaderboard({ window, n });
      setData({
        ...raw,
        buyers: filterRows(raw.buyers),
        sellers: filterRows(raw.sellers),
      });
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

  return { data, loading, error, elapsed, refresh, REFRESH_INTERVAL };
}
