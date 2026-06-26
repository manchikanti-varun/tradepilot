import { usePnL } from '../../hooks/usePnL';
import MonoNumber from '../shared/MonoNumber';
import { formatCurrency } from '../../api/client';

export default function PnLDisplay({ label = 'Unrealized P&L' }) {
  const { flashClass, pnl } = usePnL();

  if (pnl === null) return null;

  const color = pnl >= 0 ? 'buy' : 'sell';
  const sign = pnl >= 0 ? '+' : '';

  return (
    <div className={`flex items-center justify-between py-1.5 ${flashClass}`}>
      <span className="text-xs text-text-secondary">{label}</span>
      <MonoNumber value={`${sign}${formatCurrency(pnl)}`} color={color} className="text-sm font-semibold" />
    </div>
  );
}
