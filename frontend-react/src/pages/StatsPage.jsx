import { BarChart3, Target, TrendingUp, Shield, Percent, Trophy, CheckCircle2, XCircle } from 'lucide-react'

export default function StatsPage({ perf }) {
  if (!perf) return <div className="py-12 text-center text-gray-500">Loading...</div>

  const stats = [
    { icon: Target, label: 'Total Trades', value: perf.total_trades || 0, color: 'text-white' },
    { icon: TrendingUp, label: 'Win Rate', value: perf.win_rate ? `${perf.win_rate}%` : '—', color: perf.win_rate > 55 ? 'text-accent-green' : 'text-gray-400' },
    { icon: Percent, label: 'Charge Drag', value: perf.charge_drag_pct ? `${perf.charge_drag_pct}%` : '—', color: (perf.charge_drag_pct || 0) > 60 ? 'text-accent-red' : 'text-gray-400' },
    { icon: Shield, label: 'Net Positive', value: perf.net_positive ? 'Yes' : 'No', color: perf.net_positive ? 'text-accent-green' : 'text-accent-red' },
  ]

  const criteria = [
    { label: '50+ trades completed', met: perf.minimum_trades_met, value: `${perf.total_trades}/50` },
    { label: 'Net P&L positive', met: perf.net_positive, value: perf.net_positive ? 'Positive' : 'Negative' },
    { label: 'Win rate above 55%', met: perf.win_rate_met, value: `${perf.win_rate || 0}%` },
    { label: 'Charge drag below 60%', met: perf.charge_drag_acceptable, value: `${perf.charge_drag_pct || 0}%` },
  ]

  return (
    <div className="py-3">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 size={18} className="text-accent-blue" /> Performance
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Track your progress toward proven status</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-dark-700 border border-dark-600 rounded-xl p-4">
            <Icon size={14} className="text-gray-500 mb-2" />
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* MVP Validation */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-amber-400" />
          <span className="text-sm font-bold">MVP Validation Gate</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">All 4 must pass to unlock proven risk levels (8-15%)</p>
        
        <div className="space-y-3">
          {criteria.map(({ label, met, value }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {met ? <CheckCircle2 size={14} className="text-accent-green" /> : <XCircle size={14} className="text-gray-600" />}
                <span className={`text-xs ${met ? 'text-gray-200' : 'text-gray-500'}`}>{label}</span>
              </div>
              <span className={`text-xs font-semibold ${met ? 'text-accent-green' : 'text-gray-500'}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className={`mt-4 text-center py-2 rounded-lg text-xs font-bold ${
          perf.all_passed ? 'bg-accent-green/15 text-accent-green' : 'bg-dark-600 text-gray-500'
        }`}>
          {perf.all_passed ? 'ALL PASSED — Ready for proven risk levels' : `${criteria.filter(c => c.met).length}/4 criteria met`}
        </div>
      </div>
    </div>
  )
}
