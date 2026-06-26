import { useState, useEffect } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { historyApi } from '../api/history';
import SectionLabel from '../components/shared/SectionLabel';
import MonoNumber from '../components/shared/MonoNumber';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';
import EmptyState from '../components/shared/EmptyState';
import { formatCurrency } from '../api/client';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await historyApi.stats();
      setStats(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (error && !stats) return <div className="p-4"><ErrorState message="Failed to load stats" onRetry={fetchStats} /></div>;
  if (loading && !stats) return <div className="p-4"><SkeletonCard /></div>;
  if (!stats || stats.summary?.total_trades === 0) return <div className="p-4"><EmptyState icon={BarChart3} title="No trades yet" subtitle="Stats appear after your first completed trade" /></div>;

  const { summary, daily_pnl, capital_curve } = stats;

  return (
    <div className="p-4 space-y-4">
      <SectionLabel>Performance</SectionLabel>

      {/* Summary Grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Trades" value={summary.total_trades} />
        <StatBox label="Win Rate" value={`${summary.win_rate}%`} color={summary.win_rate >= 55 ? 'buy' : 'watch'} />
        <StatBox label="Net P&L" value={formatCurrency(summary.net_pnl)} color={summary.net_pnl >= 0 ? 'buy' : 'sell'} />
        <StatBox label="Return" value={`${summary.return_pct}%`} color={summary.return_pct >= 0 ? 'buy' : 'sell'} />
        <StatBox label="Charges" value={formatCurrency(summary.total_charges)} color="watch" />
        <StatBox label="Avg Hold" value={`${summary.avg_duration_min.toFixed(0)}m`} />
      </div>

      {/* Capital Curve */}
      {capital_curve?.length > 1 && (
        <div className="bg-surface border border-border-dim rounded-lg p-3">
          <SectionLabel className="mb-2 block">Capital Growth</SectionLabel>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={capital_curve}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#4A4A58' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#4A4A58' }} tickLine={false} axisLine={false} width={45} tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="capital" stroke="#2563EB" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily P&L */}
      {daily_pnl?.length > 0 && (
        <div className="bg-surface border border-border-dim rounded-lg p-3">
          <SectionLabel className="mb-2 block">Daily P&L</SectionLabel>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={daily_pnl}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#4A4A58' }} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: '#4A4A58' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {daily_pnl.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#16A34A' : '#DC2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-surface border border-border-dim rounded-lg p-2.5 text-center">
      <MonoNumber value={value} color={color} className="text-sm font-medium" />
      <p className="text-[9px] text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-elevated border border-border-dim rounded px-2 py-1 text-[10px] font-mono text-text-primary">
      ₹{payload[0].value?.toFixed?.(2) || payload[0].value}
    </div>
  );
}
