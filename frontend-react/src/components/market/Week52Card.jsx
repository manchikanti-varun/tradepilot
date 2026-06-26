import { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { marketApi } from '../../api/market';

export default function Week52Card() {
  const [data, setData] = useState(null);

  useEffect(() => {
    marketApi.week52().then(setData).catch(() => {});
  }, []);

  if (!data || (!data.near_high?.length && !data.near_low?.length)) return null;

  return (
    <div className="px-4 py-2">
      <div className="bg-surface border border-border-dim rounded-lg p-3">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-2">52-Week Levels</p>
        {data.near_high?.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1 mb-1">
              <ArrowUpCircle size={10} className="text-buy" />
              <span className="text-[9px] text-buy font-medium">NEAR HIGH</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {data.near_high.slice(0, 4).map((s) => (
                <span key={s.symbol} className="text-[9px] bg-buy/10 border border-buy/20 rounded px-1.5 py-0.5 font-mono">
                  <span className="text-text-primary">{s.symbol}</span>
                  <span className="text-buy ml-1">{s.pct_away}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {data.near_low?.length > 0 && (
          <div>
            <div className="flex items-center gap-1 mb-1">
              <ArrowDownCircle size={10} className="text-sell" />
              <span className="text-[9px] text-sell font-medium">NEAR LOW</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              {data.near_low.slice(0, 4).map((s) => (
                <span key={s.symbol} className="text-[9px] bg-sell/10 border border-sell/20 rounded px-1.5 py-0.5 font-mono">
                  <span className="text-text-primary">{s.symbol}</span>
                  <span className="text-sell ml-1">{s.pct_away}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
