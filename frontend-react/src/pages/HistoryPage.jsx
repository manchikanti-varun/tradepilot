import { useState, useEffect } from 'react';
import { Download, History } from 'lucide-react';
import { historyApi } from '../api/history';
import SectionLabel from '../components/shared/SectionLabel';
import MonoNumber from '../components/shared/MonoNumber';
import Badge from '../components/shared/Badge';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';
import EmptyState from '../components/shared/EmptyState';
import { formatCurrency } from '../api/client';

export default function HistoryPage() {
  const [trades, setTrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const res = await historyApi.list(100);
      setTrades(res.trades || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTrades(); }, []);

  const handleExport = () => {
    window.open(historyApi.exportUrl(), '_blank');
  };

  const filtered = trades ? trades.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'win') return t.exit_price && t.exit_price > t.entry_price;
    if (filter === 'loss') return t.exit_price && t.exit_price <= t.entry_price;
    return true;
  }) : [];

  // Summary
  const wins = trades ? trades.filter((t) => t.exit_price && t.exit_price > t.entry_price).length : 0;
  const losses = trades ? trades.filter((t) => t.exit_price && t.exit_price <= t.entry_price).length : 0;
  const total = trades?.length || 0;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : '—';

  if (error && !trades) return <div className="p-4"><ErrorState message="Failed to load history" onRetry={fetchTrades} /></div>;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SectionLabel>Trade History</SectionLabel>
          {total > 0 && <span className="text-[10px] font-mono text-text-muted">{total}</span>}
        </div>
        {total > 0 && (
          <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 rounded bg-overlay border border-border-dim text-[10px] text-text-secondary hover:text-text-primary">
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {/* Summary Bar */}
      {total > 0 && (
        <div className="flex items-center gap-4 mb-3 py-2 px-3 bg-surface border border-border-dim rounded-lg text-[10px]">
          <span className="text-text-muted">Trades: <span className="font-mono text-text-primary">{total}</span></span>
          <span className="text-text-muted">Wins: <span className="font-mono text-buy">{wins}</span></span>
          <span className="text-text-muted">Losses: <span className="font-mono text-sell">{losses}</span></span>
          <span className="text-text-muted">WR: <span className="font-mono text-text-primary">{winRate}%</span></span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 mb-3">
        {['all', 'win', 'loss'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium ${
              filter === f ? 'bg-info/15 text-info' : 'bg-overlay text-text-muted'
            }`}
          >
            {f === 'all' ? 'All' : f === 'win' ? 'Wins' : 'Losses'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && !trades ? <SkeletonCard /> : filtered.length === 0 ? (
        <EmptyState icon={History} title="No trades yet" subtitle="Report your first trade to see history" />
      ) : (
        <div className="space-y-1">
          {filtered.map((trade) => {
            const pnl = trade.exit_price && trade.entry_price ? (trade.exit_price - trade.entry_price) * trade.qty : null;
            const isWin = pnl !== null && pnl > 0;
            return (
              <div key={trade.id} className="flex items-center justify-between bg-surface border border-border-dim rounded-lg px-3 py-2.5">
                <div>
                  <span className="text-xs font-mono font-medium text-text-primary">{trade.ticker}</span>
                  <span className="text-[9px] text-text-muted ml-2">{trade.entry_time?.slice(0, 10)}</span>
                  <span className="text-[9px] text-text-muted ml-2">Qty {trade.qty}</span>
                </div>
                <div className="flex items-center gap-2">
                  {pnl !== null ? (
                    <MonoNumber value={formatCurrency(pnl)} color={isWin ? 'buy' : 'sell'} className="text-[11px] font-medium" />
                  ) : (
                    <Badge variant="info">OPEN</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
