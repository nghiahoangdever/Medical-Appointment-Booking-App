import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiOptions {
  /** Re-fetch every `pollMs` milliseconds (simple polling instead of real-time updates). */
  pollMs?: number;
  /** Keep showing the previous result while a new `load` (e.g. changed filters) is fetching. */
  keepData?: boolean;
}

/**
 * Loads data with `load` (memoize it with useCallback) and exposes `refresh()` for a
 * Refresh button. Pass `null` to load nothing yet. Responses from outdated requests are ignored.
 */
export function useApi<T>(
  load: (() => Promise<T>) | null,
  { pollMs, keepData = false }: UseApiOptions = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(load !== null);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!load) return;
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const result = await load();
      if (requestId !== latestRequest.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [load]);

  // A new `load` means different data: drop the old result (unless keepData) and fetch again.
  useEffect(() => {
    if (!keepData) setData(null);
    setError(null);
    if (load) void refresh();
    else setLoading(false);
  }, [load, refresh, keepData]);

  useEffect(() => {
    if (!pollMs || !load) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs, load]);

  return { data, setData, error, loading, refresh };
}
