import { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

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
    return (
      <span className="text-[10px] font-mono font-bold text-sell px-2 py-0.5 rounded bg-sell/10">
        EXPIRED
      </span>
    );
  }

  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  const display = `${min}:${String(sec).padStart(2, '0')}`;

  const color = remaining < 60 ? 'text-sell'
    : remaining < 180 ? 'text-watch'
    : 'text-text-muted';

  const bgColor = remaining < 60 ? 'bg-sell/8'
    : remaining < 180 ? 'bg-watch/8'
    : 'bg-overlay';

  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${bgColor}`}>
      <Timer size={10} className={color} />
      <span className={`text-[10px] font-mono font-semibold ${color}`}>
        {display}
      </span>
    </div>
  );
}
