import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { historyApi } from '../api/history';
import SectionLabel from '../components/shared/SectionLabel';
import MonoNumber from '../components/shared/MonoNumber';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';
import EmptyState from '../components/shared/EmptyState';
import { formatCurrency } from '../api/client';

export default function RealityCheckPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await historyApi.realityCheck();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (error && !data) return <div className="p-4"><ErrorState message="Failed to load reality check" onRetry={fetchData} /></div>;
  if (loading && !data) return <div className="p-4"><SkeletonCard /></div>;
  if (!data) return <div className="p-4"><EmptyState icon={Scale} title="No data yet" subtitle="Complete some trades first" /></div>;

  const isBeating = data.outperformance_pct > 0;

  return (
    <div className="p-4 space-y-4">
      <SectionLabel>Reality Check</SectionLabel>

      {/* Verdict */}
      <div className={`rounded-lg p-4 border ${isBeating ? 'bg-buy/10 border-buy/30' : 'bg-sell/10 border-sell/30'}`}>
        <p className={`text-sm font-medium ${isBeating ? 'text-buy' : 'text-sell'}`}>{data.verdict_type === 'BEATING' ? 'Beating the market' : data.verdict_type === 'POSITIVE_BUT_LAGGING' ? 'Profitable but lagging' : 'Underperforming'}</p>
        <p className="text-[11px] text-text-secondary mt-1">{data.verdict}</p>
      </div>

      {/* Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border-dim rounded-lg p-3 text-center">
          <p className="text-[9px] text-text-muted uppercase">Your Return</p>
          <MonoNumber value={`${data.strategy_return_pct >= 0 ? '+' : ''}${data.strategy_return_pct}%`} color={data.strategy_return_pct >= 0 ? 'buy' : 'sell'} className="text-lg font-semibold" />
          <p className="text-[9px] text-text-muted mt-1">Active Trading</p>
        </div>
        <div className="bg-surface border border-border-dim rounded-lg p-3 text-center">
          <p className="text-[9px] text-text-muted uppercase">Nifty B&H</p>
          <MonoNumber value={`${data.nifty_return_pct >= 0 ? '+' : ''}${data.nifty_return_pct}%`} color={data.nifty_return_pct >= 0 ? 'buy' : 'sell'} className="text-lg font-semibold" />
          <p className="text-[9px] text-text-muted mt-1">Passive</p>
        </div>
      </div>

      {/* Alpha */}
      <div className="bg-surface border border-border-dim rounded-lg p-4 text-center">
        <p className="text-[9px] text-text-muted uppercase">Alpha Generated</p>
        <MonoNumber value={`${data.outperformance_pct >= 0 ? '+' : ''}${data.outperformance_pct}%`} color={isBeating ? 'buy' : 'sell'} className="text-2xl font-semibold" />
      </div>

      {/* Details */}
      <div className="bg-surface border border-border-dim rounded-lg p-3 space-y-1.5 text-[11px]">
        <div className="flex justify-between"><span className="text-text-muted">Starting Capital</span><MonoNumber value={formatCurrency(data.starting_capital)} className="font-medium" /></div>
        <div className="flex justify-between"><span className="text-text-muted">Current Capital</span><MonoNumber value={formatCurrency(data.ending_capital)} className="font-medium" /></div>
        <div className="flex justify-between"><span className="text-text-muted">Total Trades</span><MonoNumber value={data.total_trades} className="font-medium" /></div>
        <div className="flex justify-between"><span className="text-text-muted">Net Profit</span><MonoNumber value={formatCurrency(data.net_profit)} color={data.net_profit >= 0 ? 'buy' : 'sell'} className="font-medium" /></div>
      </div>
    </div>
  );
}
