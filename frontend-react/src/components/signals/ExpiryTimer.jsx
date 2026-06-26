import { useState, useEffect } from 'react';

export default function ExpiryTimer({ expiresInSec }) {
  const [remaining, setRemaining] = useState(expiresInSec || 0);

  useEffect(() => {
    setRemaining(expiresInSec || 0);
  }, [expiresInSec]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining > 0]);

  if (remaining <= 0) {
    return <span className="text-[10px] font-mono text-sell">EXPIRED</span>;
  }

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const display = `${min}:${String(sec).padStart(2, '0')}`;

  const color = remaining < 60 ? 'text-sell'
    : remaining < 180 ? 'text-watch'
    : 'text-text-muted';

  const pulse = remaining < 60 ? 'animate-pulse-slow' : '';

  return (
    <span className={`text-[11px] font-mono font-medium ${color} ${pulse}`}>
      {display}
    </span>
  );
}
