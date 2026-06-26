export default function PositionProgress({ entryPrice, currentLtp, stopPrice, targetPrice }) {
  if (!entryPrice || !stopPrice || !targetPrice || !currentLtp) return null;

  const range = targetPrice - stopPrice;
  if (range <= 0) return null;

  const currentPct = Math.max(0, Math.min(100, ((currentLtp - stopPrice) / range) * 100));
  const entryPct = ((entryPrice - stopPrice) / range) * 100;

  return (
    <div className="py-2">
      <div className="relative h-2 bg-border-dim rounded-full overflow-hidden">
        {/* Red zone (below entry) */}
        <div
          className="absolute top-0 left-0 h-full bg-sell/30 rounded-l-full"
          style={{ width: `${entryPct}%` }}
        />
        {/* Green zone (above entry) */}
        <div
          className="absolute top-0 h-full bg-buy/30 rounded-r-full"
          style={{ left: `${entryPct}%`, width: `${100 - entryPct}%` }}
        />
        {/* Current position marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-text-primary"
          style={{ left: `${currentPct}%` }}
        />
        {/* Entry marker (triangle) */}
        <div
          className="absolute -top-1 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-text-muted"
          style={{ left: `calc(${entryPct}% - 3px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-sell">SL ₹{stopPrice.toFixed(0)}</span>
        <span className="text-[9px] font-mono text-text-muted">₹{currentLtp.toFixed(1)}</span>
        <span className="text-[9px] font-mono text-buy">T ₹{targetPrice.toFixed(0)}</span>
      </div>
    </div>
  );
}
