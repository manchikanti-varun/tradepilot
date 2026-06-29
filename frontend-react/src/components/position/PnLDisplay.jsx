import { TrendingUp, TrendingDown } from 'lucide-react';
import { usePnL } from '../../hooks/usePnL';
import { formatCurrency } from '../../api/client';

export default function PnLDisplay({ label = 'Unrealized P&L' }) {
  const { flashClass, pnl } = usePnL();

  if (pnl === null) return null;

  const isProfit = pnl >= 0;
  const sign = isProfit ? '+' : '';
  const Icon = isProfit ? TrendingUp : TrendingDown;

  return (
    <div className={`flex items-center justify-between py-2 ${flashClass}`}>
      <span className="text-[11px] text-text-muted font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={isProfit ? 'text-buy' : 'text-sell'} />
        <span className={`text-base font-mono font-bold ${isProfit ? 'text-buy' : 'text-sell'}`}>
          {sign}{formatCurrency(pnl)}
        </span>
      </div>
    </div>
  );
}
