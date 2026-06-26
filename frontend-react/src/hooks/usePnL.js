import { useRef, useState, useEffect } from 'react';
import { usePositionStore } from '../store/usePositionStore';

export function usePnL() {
  const unrealizedPnL = usePositionStore((s) => s.unrealizedPnL);
  const prevPnL = useRef(unrealizedPnL);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (prevPnL.current === null || unrealizedPnL === null) {
      prevPnL.current = unrealizedPnL;
      return;
    }

    const prev = prevPnL.current;
    const curr = unrealizedPnL;

    if (prev < 0 && curr >= 0) {
      setFlashClass('animate-flash-green');
      setTimeout(() => setFlashClass(''), 300);
    } else if (prev >= 0 && curr < 0) {
      setFlashClass('animate-flash-red');
      setTimeout(() => setFlashClass(''), 300);
    }

    prevPnL.current = curr;
  }, [unrealizedPnL]);

  return { flashClass, pnl: unrealizedPnL };
}
