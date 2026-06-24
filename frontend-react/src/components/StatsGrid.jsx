export default function StatsGrid({ perf }) {
  if (!perf) return null

  const stats = [
    { label: 'Total Trades', value: perf.total_trades || 0, color: 'text-white' },
    { label: 'Win Rate', value: perf.win_rate ? `${perf.win_rate}%` : '—', color: perf.win_rate > 55 ? 'text-accent-green' : 'text-white' },
    { label: 'Net P&L', value: perf.net_pnl !== undefined ? `₹${perf.net_pnl}` : '—', color: perf.net_positive ? 'text-accent-green' : 'text-accent-red' },
    { label: 'Charge Drag', value: perf.charge_drag_pct ? `${perf.charge_drag_pct}%` : '—', color: perf.charge_drag_pct > 60 ? 'text-accent-red' : 'text-white' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-dark-700 border border-dark-600 rounded-xl p-4 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* MVP Progress */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">MVP Validation Progress</p>
        <div className="space-y-2 text-xs">
          <ProgressRow label="50 trades" done={perf.minimum_trades_met} value={`${perf.total_trades}/50`} />
          <ProgressRow label="Net positive" done={perf.net_positive} value={perf.net_positive ? '✓' : '✗'} />
          <ProgressRow label="Win rate >55%" done={perf.win_rate_met} value={`${perf.win_rate || 0}%`} />
          <ProgressRow label="Charge drag <60%" done={perf.charge_drag_acceptable} value={`${perf.charge_drag_pct || 0}%`} />
        </div>
      </div>
    </div>
  )
}

function ProgressRow({ label, done, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${done ? 'text-accent-green' : 'text-gray-500'}`}>
        {done ? '✓' : '○'} {value}
      </span>
    </div>
  )
}
