import { useState, useEffect } from 'react';
import { Sunrise, TrendingUp, TrendingDown } from 'lucide-react';
import { marketApi } from '../../api/market';

export default function PremarketCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    marketApi.premarket().then(setData).catch(() => {});
  }, []);

  if (!data || (!data.gap_ups?.length && !data.gap_downs?.length)) return null;

  return (
    <div className="px-4 py-2">
      <div className="bg-surface border border-watch/15 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-watch/12 flex items-center justify-center">
            <Sunrise size={13} className="text-watch" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-watch font-semibold">Gap Scanner</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-buy font-semibold mb-2 flex items-center gap-1">
              <TrendingUp size={10} /> GAP UP
            </p>
            {data.gap_ups?.slice(0, 3).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-medium text-text-primary">{s.symbol}</span>
                <span className="text-[10px] font-mono text-buy font-semibold">+{s.gap_pct}%</span>
              </div>
            ))}
            {!data.gap_ups?.length && <p className="text-[10px] text-text-muted">None</p>}
          </div>
          <div>
            <p className="text-[10px] text-sell font-semibold mb-2 flex items-center gap-1">
              <TrendingDown size={10} /> GAP DOWN
            </p>
            {data.gap_downs?.slice(0, 3).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-medium text-text-primary">{s.symbol}</span>
                <span className="text-[10px] font-mono text-sell font-semibold">{s.gap_pct}%</span>
              </div>
            ))}
            {!data.gap_downs?.length && <p className="text-[10px] text-text-muted">None</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
