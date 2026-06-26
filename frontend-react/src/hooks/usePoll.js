import { useEffect, useRef, useCallback } from 'react';

export function usePoll(fetchFn, intervalMs, { enabled = true, immediate = true } = {}) {
  const intervalRef = useRef(null);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const execute = useCallback(async () => {
    try {
      await fetchRef.current();
    } catch {
      // Errors handled by the fetch function itself
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (immediate) {
      execute();
    }

    intervalRef.current = setInterval(execute, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        execute();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(execute, intervalMs);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, intervalMs, execute, immediate]);

  return { refetch: execute };
}
