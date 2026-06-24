export default function SignalCard({ signals }) {
  if (!signals?.signals?.length) {
    return (
      <div className="bg-dark-700 border border-dark-600 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">📡</div>
        <p className="text-gray-400 text-sm">No actionable signals right now</p>
        <p className="text-gray-500 text-xs mt-1">Scanning continues every 3 min during market hours</p>
      </div>
    )
  }

  const s = signals.signals[0]

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">Priority #1</p>
      
      <div className="border-l-[3px] border-accent-green pl-4">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-extrabold">{s.symbol}</span>
          <span className="bg-accent-green/15 text-accent-green px-2 py-0.5 rounded text-xs font-bold">
            {s.grade}
          </span>
        </div>
        
        <p className="text-xs text-gray-400 mt-1">{s.sector} • Score {s.composite} • R:R {s.risk_reward}</p>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="bg-dark-900 px-2.5 py-1 rounded-lg text-[11px] text-gray-300">
            Net <span className="font-bold text-white">₹{s.net_after_charges.toFixed(2)}</span>
          </span>
          <span className="bg-dark-900 px-2.5 py-1 rounded-lg text-[11px] text-gray-300">
            Break-even <span className="font-bold text-white">{s.breakeven_pct}%</span>
          </span>
          <span className="bg-dark-900 px-2.5 py-1 rounded-lg text-[11px] text-gray-300">
            Qty <span className="font-bold text-white">{s.qty}</span>
          </span>
        </div>

        <p className="text-sm font-bold mt-3 text-white">{s.message}</p>

        <div className="mt-3 inline-block bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold">
          Buy in Angel One
        </div>
      </div>
    </div>
  )
}
