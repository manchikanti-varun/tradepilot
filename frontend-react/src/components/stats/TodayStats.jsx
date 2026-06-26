import { useMarketStore } from '../../store/useMarketStore';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import { formatCurrency } from '../../api/client';

export default function TodayStats() {
  const todayPnL = useMarketStore((s) => s.todayPnL);
  const winRate = useMarketStore((s) => s.winRate);
  const tradeCount = useMarketStore((s) => s.tradeCount);

  return (
    <div className="px-4 py-3">
      <SectionLabel className="mb-2 block">Today</SectionLabel>
      <div className="space-y-1.5">
        <StatRow label="Trades" value={tradeCount} />
        <StatRow label="Win Rate" value={winRate ? `${winRate}%` : '—'} color={winRate >= 55 ? 'buy' : winRate > 0 ? 'watch' : undefined} />
        <StatRow label="P&L" value={formatCurrency(todayPnL)} color={todayPnL >= 0 ? 'buy' : 'sell'} />
      </div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <MonoNumber value={value} color={color} className="text-xs font-medium" />
    </div>
  );
}
