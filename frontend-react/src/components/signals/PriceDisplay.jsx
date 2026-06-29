import MonoNumber from '../shared/MonoNumber';

export default function PriceDisplay({ label, price, pct, color }) {
  const labelColor = color === 'sell' ? 'text-sell' : color === 'buy' ? 'text-buy' : 'text-text-secondary';
  
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[11px] font-medium ${labelColor}`}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono font-semibold text-text-primary">
          ₹{Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
        {pct !== undefined && pct !== 0 && (
          <span className={`text-[10px] font-mono font-medium ${pct >= 0 ? 'text-buy' : 'text-sell'}`}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
