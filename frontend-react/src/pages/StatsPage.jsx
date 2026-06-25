import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, Trophy, Zap, Clock, Target, RefreshCw } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { api, formatCurrency } from '../api'

export default function StatsPage({ onNavigate }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.stats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  if (!stats || stats.summary.total_trades === 0) {
    return (
      <div className="py-12 text-center">
        <BarChart3 size={40} className="mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-400">No trades yet</p>
        <p className="text-xs text-gray-600 mt-1">Stats will appear after your first completed trade</p>
      </div>
    )
  }

  const { summary, best_trade, worst_trade, daily_pnl, capital_curve, win_rate_series, sector_stats } = stats

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-accent-blue" />
        <h2 className="text-base font-bold">Performance</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Trades" value={summary.total_trades} />
        <StatCard label="Win Rate" value={`${summary.win_rate}%`}
          color={summary.win_rate >= 55 ? 'text-green-400' : summary.win_rate >= 45 ? 'text-yellow-400' : 'text-red-400'} />
        <StatCard label="Net P&L" value={formatCurrency(summary.net_pnl)}
          color={summary.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Return" value={`${summary.return_pct}%`}
          color={summary.return_pct >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Charges Paid" value={formatCurrency(summary.total_charges)} color="text-amber-400" />
        <StatCard label="Avg Duration" value={`${summary.avg_duration_min.toFixed(0)} min`} />
      </div>

      {/* Capital Growth Chart */}
      {capital_curve.length > 1 && (
        <ChartSection title="Capital Growth" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={capital_curve}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={45}
                tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} />
              <Tooltip content={<CustomTooltip prefix="₹" />} />
              <Line type="monotone" dataKey="capital" stroke="#2196F3" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Daily P&L Chart */}
      {daily_pnl.length > 0 && (
        <ChartSection title="Daily P&L (Last 30 Days)" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={daily_pnl}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#6b7280' }} tickLine={false} axisLine={false}
                tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={40}
                tickFormatter={v => `₹${v}`} />
              <Tooltip content={<CustomTooltip prefix="₹" />} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {daily_pnl.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#4ade80' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Win Rate Over Time */}
      {win_rate_series.length > 2 && (
        <ChartSection title="Win Rate (Rolling 10 Trades)" icon={Target}>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={win_rate_series}>
              <XAxis dataKey="trade_num" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={30}
                tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip suffix="%" />} />
              <Line type="monotone" dataKey="win_rate" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Win/Loss Pie */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Win / Loss</p>
          <ResponsiveContainer width="100%" height={100}>
            <PieChart>
              <Pie data={[
                { name: 'Wins', value: summary.wins },
                { name: 'Losses', value: summary.losses },
              ]} cx="50%" cy="50%" innerRadius={25} outerRadius={40} dataKey="value">
                <Cell fill="#4ade80" />
                <Cell fill="#f87171" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 text-[10px]">
            <span className="text-green-400">{summary.wins}W</span>
            <span className="text-red-400">{summary.losses}L</span>
          </div>
        </div>

        {/* Best/Worst */}
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 space-y-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Highlights</p>
          {best_trade && (
            <div>
              <p className="text-[10px] text-gray-500">Best Trade</p>
              <p className="text-sm font-bold text-green-400">{best_trade.ticker} +{formatCurrency(best_trade.pnl)}</p>
            </div>
          )}
          {worst_trade && (
            <div>
              <p className="text-[10px] text-gray-500">Worst Trade</p>
              <p className="text-sm font-bold text-red-400">{worst_trade.ticker} {formatCurrency(worst_trade.pnl)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sector Performance */}
      {Object.keys(sector_stats).length > 0 && (
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Sector Performance</p>
          <div className="space-y-2">
            {Object.entries(sector_stats)
              .sort((a, b) => b[1].pnl - a[1].pnl)
              .slice(0, 6)
              .map(([sector, data]) => (
                <div key={sector} className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-200">{sector}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{data.trades} trades</span>
                  </div>
                  <span className={`text-xs font-bold ${data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {data.pnl >= 0 ? '+' : ''}{formatCurrency(data.pnl)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Charge Analysis */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-amber-400" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Charge Impact</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-bold text-amber-400">{formatCurrency(summary.total_charges)}</p>
            <p className="text-[10px] text-gray-500">Total Paid</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{summary.charge_drag_pct}%</p>
            <p className="text-[10px] text-gray-500">of Gross P&L</p>
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {summary.total_trades > 0 ? formatCurrency(summary.total_charges / summary.total_trades) : '—'}
            </p>
            <p className="text-[10px] text-gray-500">Per Trade</p>
          </div>
        </div>
      </div>

      {/* Reality Check Link */}
      {onNavigate && (
        <button onClick={() => onNavigate('reality')}
          className="w-full bg-dark-700 border border-accent-blue/30 rounded-xl p-4 flex items-center justify-between hover:border-accent-blue/60 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚖️</span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">Reality Check</p>
              <p className="text-[11px] text-gray-500">Compare your returns vs Nifty buy-and-hold</p>
            </div>
          </div>
          <span className="text-gray-500 text-xs">→</span>
        </button>
      )}
    </div>
  )
}

function StatCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-3">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function ChartSection({ title, icon: Icon, children }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-accent-blue" />
        <span className="text-xs font-bold text-gray-300">{title}</span>
      </div>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-900 border border-dark-500 rounded-lg px-3 py-1.5 text-xs">
      <span className="text-white font-bold">{prefix}{payload[0].value?.toFixed?.(2) || payload[0].value}{suffix}</span>
    </div>
  )
}
