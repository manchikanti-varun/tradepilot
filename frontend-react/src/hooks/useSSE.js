import { useEffect } from 'react';
import { connectSSE, disconnectSSE } from '../api/sse';
import { useAppStore } from '../store/useAppStore';

export function useSSE() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    connectSSE();

    return () => {
      disconnectSSE();
    };
  }, [isAuthenticated]);
}
