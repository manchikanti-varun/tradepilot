import { Sun, Star, Shield, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../api'

export default function BriefCard({ brief }) {
  if (!brief) return null

  const outlook = brief.market_outlook
  const cap = brief.capital_snapshot
  const risk = brief.risk_state
  const yesterday = brief.yesterday_recap

  return (
    <div className="bg-gradient-to-br from-purple-950/20 to-dark-700 border border-purple-500/20 rounded-2xl p-4 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sun size={14} className="text-purple-400" />
          <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Morning Brief</span>
        </div>
        <span className="text-[10px] text-gray-500">{brief.date}</span>
      </div>

      {/* Weather / Outlook */}
      {outlook && (
        <div className="bg-dark-900/50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{outlook.weather?.split(' ')[0]}</span>
            <div>
              <p className="text-xs font-bold text-white">{outlook.weather?.split(' ').slice(1).join(' ')}</p>
              <p className="text-[11px] text-gray-400">{outlook.advice}</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="Capital" value={formatCurrency(cap?.current_capital)} />
        <MiniStat label="VIX" value={brief.vix?.toFixed(1) || '—'}
          color={brief.vix > 22 ? 'text-red-400' : brief.vix > 17 ? 'text-amber-400' : 'text-green-400'} />
        <MiniStat label="Risk" value={risk?.mode || 'GO'}
          color={risk?.mode === 'GO' ? 'text-green-400' : risk?.mode === 'CAUTION' ? 'text-amber-400' : 'text-red-400'} />
      </div>

      {/* Yesterday Recap */}
      {yesterday && (
        <div className="flex items-center gap-2 mb-3 bg-dark-900/30 rounded-lg px-3 py-2">
          {yesterday.net_pnl >= 0
            ? <TrendingUp size={12} className="text-green-400" />
            : <TrendingDown size={12} className="text-red-400" />
          }
          <span className="text-[11px] text-gray-300">
            Yesterday: <span className={yesterday.net_pnl >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
              {yesterday.net_pnl >= 0 ? '+' : ''}{formatCurrency(yesterday.net_pnl)}
            </span>
            {yesterday.charge_drag_pct > 0 && (
              <span className="text-gray-500"> • Charges ate {yesterday.charge_drag_pct.toFixed(0)}%</span>
            )}
          </span>
        </div>
      )}

      {/* Summary Line */}
      <p className="text-xs text-gray-300 leading-relaxed">{brief.one_line_summary}</p>

      {/* Top Stocks */}
      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="text-[10px] text-gray-500 self-center">Watch:</span>
          {brief.watchlist_summary.top_3_by_score.map(s => (
            <span key={s.ticker} className="inline-flex items-center gap-1 bg-dark-900 px-2 py-1 rounded-lg text-[11px]">
              <Star size={8} className="text-accent-green" />
              <span className="text-gray-300 font-medium">{s.ticker}</span>
              <span className="font-bold text-accent-green">{s.grade}</span>
            </span>
          ))}
        </div>
      )}

      {/* Events */}
      {brief.event_calendar_today?.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <Shield size={10} className="text-amber-400" />
          <span className="text-[10px] text-amber-300">
            {brief.event_calendar_today.map(e => e.event).join(' • ')}
          </span>
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, color = 'text-white' }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}
