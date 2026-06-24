import { Activity, AlertOctagon, Eye, ShieldCheck } from 'lucide-react'

export default function PositionCard({ data }) {
  const p = data.position
  const isProfit = p.net_pnl >= 0
  const exitSignal = data.exit_signal
  const isUrgent = exitSignal?.should_exit

  return (
    <div className={`rounded-2xl p-5 mb-3 border ${
      isUrgent ? 'border-red-500/40 bg-gradient-to-br from-red-950/15 to-dark-700'
               : 'border-accent-green/25 bg-gradient-to-br from-emerald-950/15 to-dark-700'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className={isUrgent ? 'text-accent-red' : 'text-accent-green'} />
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Active Position</span>
      </div>

      <div className="flex justify-between items-baseline">
        <span className="text-xl font-extrabold">{p.ticker}</span>
        <span className={`text-xl font-extrabold ${isProfit ? 'text-accent-green' : 'text-accent-red'}`}>
          {isProfit ? '+' : ''}₹{p.net_pnl.toFixed(2)}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-gray-400">
        <div className="flex gap-3">
          <span>Qty {p.qty} @ ₹{p.entry_price}</span>
          <span>LTP ₹{p.current_ltp}</span>
          <span className="text-gray-500">{p.phase}</span>
        </div>
        <div className="flex gap-3">
          <span>Stop ₹{p.stop_price}</span>
          <span>Charges ~₹{p.charges_estimate}</span>
        </div>
      </div>

      {isUrgent && (
        <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
          <AlertOctagon size={14} className="text-accent-red mt-0.5 shrink-0" />
          <div>
            <p className="text-accent-red font-bold text-xs">{exitSignal.urgency}</p>
            <p className="text-red-300/70 text-[11px] mt-0.5">{exitSignal.reason}</p>
          </div>
        </div>
      )}

      {data.reeval && !isUrgent && (
        <div className="mt-2 flex items-center gap-1.5">
          {data.reeval.action === 'HOLD' ? <ShieldCheck size={12} className="text-accent-green" /> : <Eye size={12} className="text-amber-400" />}
          <span className={`text-[11px] font-medium ${
            data.reeval.action === 'HOLD' ? 'text-accent-green' : data.reeval.action === 'WATCH' ? 'text-amber-400' : 'text-accent-red'
          }`}>{data.reeval.action} — score {data.reeval.score?.toFixed(0)}</span>
        </div>
      )}
    </div>
  )
}
