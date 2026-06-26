import { useEffect } from 'react';
import { useMarketStore } from '../../store/useMarketStore';

export default function ScanCountdown() {
  const scanCountdown = useMarketStore((s) => s.scanCountdown);
  const lastScanTime = useMarketStore((s) => s.lastScanTime);
  const tickScanCountdown = useMarketStore((s) => s.tickScanCountdown);

  useEffect(() => {
    const timer = setInterval(tickScanCountdown, 1000);
    return () => clearInterval(timer);
  }, [tickScanCountdown]);

  const progress = ((90 - scanCountdown) / 90) * 100;
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const isStale = scanCountdown <= 0 && lastScanTime && (Date.now() - new Date(lastScanTime).getTime()) > 180000;

  const color = isStale ? 'text-watch' : 'text-buy';
  const strokeColor = isStale ? '#D97706' : '#16A34A';

  let agoText = '';
  if (lastScanTime) {
    const ago = Math.round((Date.now() - new Date(lastScanTime).getTime()) / 1000);
    agoText = `${ago}s ago`;
  }

  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" className={color}>
        <circle cx="14" cy="14" r={radius} fill="none" stroke="#1F1F27" strokeWidth="2" />
        <circle
          cx="14" cy="14" r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <span className="text-[10px] text-text-muted font-mono">
        {agoText || `${scanCountdown}s`}
      </span>
    </div>
  );
}
