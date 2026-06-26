import { useState, useEffect } from 'react';
import { Sunrise } from 'lucide-react';
import { marketApi } from '../../api/market';

export default function PremarketCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    marketApi.premarket().then(setData).catch(() => {});
  }, []);

  if (!data || (!data.gap_ups?.length && !data.gap_downs?.length)) return null;

  return (
    <div className="px-4 py-2">
      <div className="bg-surface border border-watch/20 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Sunrise size={12} className="text-watch" />
          <span className="text-[10px] uppercase tracking-wider text-watch font-medium">Gap Scanner</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] text-buy font-medium mb-1">↑ GAP UP</p>
            {data.gap_ups?.slice(0, 3).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-mono text-text-primary">{s.symbol}</span>
                <span className="text-[10px] font-mono text-buy">+{s.gap_pct}%</span>
              </div>
            ))}
            {!data.gap_ups?.length && <p className="text-[9px] text-text-muted">None</p>}
          </div>
          <div>
            <p className="text-[9px] text-sell font-medium mb-1">↓ GAP DOWN</p>
            {data.gap_downs?.slice(0, 3).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-mono text-text-primary">{s.symbol}</span>
                <span className="text-[10px] font-mono text-sell">{s.gap_pct}%</span>
              </div>
            ))}
            {!data.gap_downs?.length && <p className="text-[9px] text-text-muted">None</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
