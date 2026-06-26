import MonoNumber from '../shared/MonoNumber';

export default function PriceDisplay({ label, price, pct, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        <MonoNumber value={`₹${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} className="text-xs font-medium" />
        {pct !== undefined && (
          <MonoNumber
            value={`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}
            color={pct >= 0 ? 'buy' : 'sell'}
            className="text-[10px]"
          />
        )}
      </div>
    </div>
  );
}
