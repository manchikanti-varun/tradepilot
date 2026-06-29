import { ShieldAlert, Target } from 'lucide-react';

export default function PositionProgress({ entryPrice, currentLtp, stopPrice, targetPrice }) {
  if (!entryPrice || !stopPrice || !targetPrice || !currentLtp) return null;

  const range = targetPrice - stopPrice;
  if (range <= 0) return null;

  const currentPct = Math.max(0, Math.min(100, ((currentLtp - stopPrice) / range) * 100));
  const entryPct = ((entryPrice - stopPrice) / range) * 100;
  const isProfit = currentLtp >= entryPrice;

  return (
    <div className="py-3">
      <div className="relative h-2.5 bg-border-dim rounded-full overflow-hidden">
        {/* Red zone (stop to entry) */}
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-sell/40 to-sell/20 rounded-l-full"
          style={{ width: `${entryPct}%` }}
        />
        {/* Green zone (entry to target) */}
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-buy/20 to-buy/40 rounded-r-full"
          style={{ left: `${entryPct}%`, width: `${100 - entryPct}%` }}
        />
        {/* Current position dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-md transition-all duration-500"
          style={{
            left: `calc(${currentPct}% - 7px)`,
            backgroundColor: isProfit ? 'var(--buy)' : 'var(--sell)',
          }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-2">
        <span className="text-[9px] font-mono text-sell flex items-center gap-0.5">
          <ShieldAlert size={8} /> ₹{stopPrice.toFixed(0)}
        </span>
        <span className={`text-[10px] font-mono font-semibold ${isProfit ? 'text-buy' : 'text-sell'}`}>
          ₹{currentLtp.toFixed(2)}
        </span>
        <span className="text-[9px] font-mono text-buy flex items-center gap-0.5">
          <Target size={8} /> ₹{targetPrice.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
