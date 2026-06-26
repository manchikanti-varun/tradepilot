import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import { formatCurrency } from '../../api/client';

export default function TodayStats() {
  const todayPnL = useMarketStore((s) => s.todayPnL);
  const winRate = useMarketStore((s) => s.winRate);
  const tradeCount = useMarketStore((s) => s.tradeCount);
  const { isMarketOpen, status } = useMarketHours();

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Today</SectionLabel>
        {!isMarketOpen && (
          <span className="text-[9px] font-mono text-text-muted">{status === 'CLOSED' ? 'CLOSED' : 'PRE'}</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Trades" value={tradeCount || '0'} />
        <MiniStat label="Win Rate" value={winRate ? `${winRate}%` : '—'} color={winRate >= 55 ? 'text-buy' : winRate > 0 ? 'text-watch' : ''} />
        <MiniStat label="P&L" value={formatCurrency(todayPnL)} color={todayPnL > 0 ? 'text-buy' : todayPnL < 0 ? 'text-sell' : ''} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = '' }) {
  return (
    <div className="bg-overlay rounded-md p-2 text-center">
      <p className={`font-mono text-xs font-medium ${color || 'text-text-primary'}`}>{value}</p>
      <p className="text-[8px] text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}
