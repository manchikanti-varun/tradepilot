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
      <div className="bg-surface border border-border-dim rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3">52-Week Levels</p>
        {data.near_high?.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowUpCircle size={12} className="text-buy" />
              <span className="text-[10px] text-buy font-semibold">NEAR HIGH</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {data.near_high.slice(0, 4).map((s) => (
                <span key={s.symbol} className="text-[10px] bg-buy/8 border border-buy/20 rounded-lg px-2 py-1 font-mono">
                  <span className="text-text-primary font-medium">{s.symbol}</span>
                  <span className="text-buy ml-1 font-semibold">{s.pct_away}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {data.near_low?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowDownCircle size={12} className="text-sell" />
              <span className="text-[10px] text-sell font-semibold">NEAR LOW</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {data.near_low.slice(0, 4).map((s) => (
                <span key={s.symbol} className="text-[10px] bg-sell/8 border border-sell/20 rounded-lg px-2 py-1 font-mono">
                  <span className="text-text-primary font-medium">{s.symbol}</span>
                  <span className="text-sell ml-1 font-semibold">{s.pct_away}%</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
