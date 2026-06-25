import { useState, useEffect } from 'react'
import { Scale, TrendingUp, TrendingDown, RefreshCw, Trophy, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api, formatCurrency } from '../api'

export default function RealityCheckPage() {
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.realityCheck(),
      api.stats(),
    ]).then(([rc, st]) => {
      setData(rc)
      setStats(st)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-12 text-center">
        <Scale size={32} className="mx-auto text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">No data for reality check yet</p>
        <p className="text-xs text-gray-600 mt-1">Complete some trades first</p>
      </div>
    )
  }

  const isBeating = data.outperformance_pct > 0
  const capitalCurve = stats?.capital_curve || []

  // Build comparison chart data (your capital vs Nifty equivalent)
  const comparisonData = capitalCurve.map((point, i) => {
    const niftyGrowth = data.nifty_return_pct > 0
      ? data.starting_capital * (1 + (data.nifty_return_pct / 100) * ((i + 1) / capitalCurve.length))
      : data.starting_capital
    return {
      date: point.date?.slice(5) || `T${i+1}`,
      you: point.capital,
      nifty: Math.round(niftyGrowth),
    }
  })

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scale size={18} className="text-accent-blue" />
        <h2 className="text-base font-bold">Reality Check</h2>
      </div>

      {/* Verdict Banner */}
      <div className={`rounded-2xl p-5 border ${
        isBeating
          ? 'bg-green-500/10 border-green-500/25'
          : data.net_profit > 0
            ? 'bg-amber-500/10 border-amber-500/25'
            : 'bg-red-500/10 border-red-500/25'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          {isBeating ? (
            <Trophy size={24} className="text-green-400" />
          ) : data.net_profit > 0 ? (
            <AlertTriangle size={24} className="text-amber-400" />
          ) : (
            <TrendingDown size={24} className="text-red-400" />
          )}
          <div>
            <p className={`text-sm font-bold ${
              isBeating ? 'text-green-400' : data.net_profit > 0 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {data.verdict_type === 'BEATING' && 'You are beating the market'}
              {data.verdict_type === 'POSITIVE_BUT_LAGGING' && 'Profitable but lagging Nifty'}
              {data.verdict_type === 'LOSING' && 'Underperforming the market'}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {data.period_start} → {data.period_end}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">{data.verdict}</p>
      </div>

      {/* Comparison Numbers */}
      <div className="grid grid-cols-2 gap-3">
        <CompareCard
          label="Your Return"
          value={`${data.strategy_return_pct >= 0 ? '+' : ''}${data.strategy_return_pct}%`}
          sublabel={formatCurrency(data.net_profit)}
          color={data.strategy_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}
          badge="Active Trading"
        />
        <CompareCard
          label="Nifty Buy & Hold"
          value={`${data.nifty_return_pct >= 0 ? '+' : ''}${data.nifty_return_pct}%`}
          sublabel="Zero effort"
          color={data.nifty_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}
          badge="Passive"
        />
      </div>

      {/* Alpha */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 text-center">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Alpha Generated</p>
        <p className={`text-2xl font-extrabold ${data.outperformance_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {data.outperformance_pct >= 0 ? '+' : ''}{data.outperformance_pct}%
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          {data.outperformance_pct > 0
            ? 'Your active trading added this value over buy-and-hold'
            : 'You would have been better off just holding Nifty 50 ETF'
          }
        </p>
      </div>

      {/* Growth Comparison Chart */}
      {comparisonData.length > 1 && (
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-300 mb-3">Your Capital vs Nifty Equivalent</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={comparisonData}>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} width={45}
                tickFormatter={v => `₹${(v/1000).toFixed(1)}k`} />
              <Tooltip content={<CompareTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line type="monotone" dataKey="you" stroke="#4ade80" strokeWidth={2} dot={false} name="Your Trading" />
              <Line type="monotone" dataKey="nifty" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Nifty B&H" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Details */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
        <p className="text-xs font-bold text-gray-300 mb-3">Details</p>
        <div className="space-y-2">
          <DetailRow label="Starting Capital" value={formatCurrency(data.starting_capital)} />
          <DetailRow label="Current Capital" value={formatCurrency(data.ending_capital)} />
          <DetailRow label="Total Trades" value={data.total_trades} />
          <DetailRow label="Net Profit" value={formatCurrency(data.net_profit)}
            color={data.net_profit >= 0 ? 'text-green-400' : 'text-red-400'} />
          <DetailRow label="Nifty Start" value={data.nifty_start > 0 ? data.nifty_start.toFixed(0) : '—'} />
          <DetailRow label="Nifty End" value={data.nifty_end > 0 ? data.nifty_end.toFixed(0) : '—'} />
        </div>
      </div>

      {/* Honest Note */}
      <div className="bg-dark-900 border border-dark-600 rounded-xl p-4 text-center">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          This compares your <span className="text-white">actual results</span> (after all charges, slippage, and mistakes)
          vs simply buying Nifty 50 ETF with the same capital on day 1. No sugarcoating.
        </p>
      </div>
    </div>
  )
}

function CompareCard({ label, value, sublabel, color, badge }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <span className="text-[9px] bg-dark-900 text-gray-500 px-1.5 py-0.5 rounded uppercase">{badge}</span>
      <p className={`text-xl font-extrabold mt-2 ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
      <p className="text-[10px] text-gray-600">{sublabel}</p>
    </div>
  )
}

function DetailRow({ label, value, color = 'text-white' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function CompareTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-[10px]">
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-bold">₹{p.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
