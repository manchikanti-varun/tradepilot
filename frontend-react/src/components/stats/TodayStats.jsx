import { BarChart3, Trophy, TrendingUp } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import SectionLabel from '../shared/SectionLabel';
import { formatCurrency } from '../../api/client';

export default function TodayStats() {
  const todayPnL = useMarketStore((s) => s.todayPnL);
  const winRate = useMarketStore((s) => s.winRate);
  const tradeCount = useMarketStore((s) => s.tradeCount);
  const { isMarketOpen, status } = useMarketHours();

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <SectionLabel>Today</SectionLabel>
        {!isMarketOpen && (
          <span className="text-[9px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-overlay">{status === 'CLOSED' ? 'CLOSED' : 'PRE'}</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat icon={BarChart3} label="Trades" value={tradeCount || '0'} />
        <MiniStat icon={Trophy} label="Win Rate" value={winRate ? `${winRate}%` : '—'} color={winRate >= 55 ? 'text-buy' : winRate > 0 ? 'text-watch' : ''} />
        <MiniStat icon={TrendingUp} label="P&L" value={formatCurrency(todayPnL)} color={todayPnL > 0 ? 'text-buy' : todayPnL < 0 ? 'text-sell' : ''} />
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color = '' }) {
  return (
    <div className="bg-overlay rounded-xl p-2.5 text-center">
      <Icon size={12} className="text-text-muted mx-auto mb-1" />
      <p className={`font-mono text-xs font-semibold ${color || 'text-text-primary'}`}>{value}</p>
      <p className="text-[9px] text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}
