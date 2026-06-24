export default function PositionCard({ data }) {
  const p = data.position
  const isProfit = p.net_pnl >= 0
  const exitSignal = data.exit_signal
  const isUrgent = exitSignal?.should_exit

  return (
    <div className={`rounded-2xl p-5 mb-3 border ${
      isUrgent ? 'border-red-500/40 bg-gradient-to-br from-red-950/20 to-dark-700'
               : 'border-accent-green/30 bg-gradient-to-br from-emerald-950/20 to-dark-700'
    }`}>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Active Position</p>
      
      <div className="flex justify-between items-baseline">
        <span className="text-2xl font-extrabold">{p.ticker}</span>
        <span className={`text-2xl font-extrabold ${isProfit ? 'text-accent-green' : 'text-accent-red'}`}>
          {isProfit ? '+' : ''}₹{p.net_pnl.toFixed(2)}
        </span>
      </div>

      <div className="mt-2 text-xs text-gray-400 space-y-0.5">
        <div>Qty {p.qty} @ ₹{p.entry_price} → ₹{p.current_ltp} • {p.phase}</div>
        <div>Stop ₹{p.stop_price} • Charges ~₹{p.charges_estimate}</div>
      </div>

      {isUrgent && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <p className="text-red-400 font-bold text-sm">{exitSignal.urgency}</p>
          <p className="text-red-300/80 text-xs mt-0.5">{exitSignal.reason}</p>
        </div>
      )}

      {data.reeval && !isUrgent && (
        <div className={`mt-2 text-xs font-medium ${
          data.reeval.action === 'HOLD' ? 'text-accent-green' :
          data.reeval.action === 'WATCH' ? 'text-amber-400' : 'text-accent-red'
        }`}>
          Re-eval: {data.reeval.action} (score {data.reeval.score?.toFixed(0)})
        </div>
      )}
    </div>
  )
}
