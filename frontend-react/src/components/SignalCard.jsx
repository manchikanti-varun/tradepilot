import { Crosshair, Zap, TrendingUp, ArrowRight } from 'lucide-react'

export default function SignalCard({ signals }) {
  if (!signals?.signals?.length) {
    return (
      <div className="bg-dark-700 border border-dark-600 rounded-2xl p-8 text-center">
        <Crosshair size={28} className="mx-auto mb-2 text-gray-600" />
        <p className="text-sm text-gray-400">No actionable signals</p>
        <p className="text-[11px] text-gray-600 mt-1">Scanning every 3 min during market hours</p>
      </div>
    )
  }

  const s = signals.signals[0]

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Crosshair size={14} className="text-accent-green" />
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Priority #1</span>
      </div>

      <div className="border-l-[3px] border-accent-green pl-4">
        <div className="flex justify-between items-baseline">
          <span className="text-2xl font-extrabold">{s.symbol}</span>
          <span className="bg-accent-green/15 text-accent-green px-2.5 py-0.5 rounded-md text-[11px] font-bold">{s.grade}</span>
        </div>

        <p className="text-xs text-gray-400 mt-1">{s.sector} • Score {s.composite} • R:R {s.risk_reward}</p>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 bg-dark-900 px-2.5 py-1 rounded-lg text-[11px]">
            <TrendingUp size={10} className="text-accent-green" />
            <span className="text-gray-400">Net</span>
            <span className="font-bold text-white">₹{s.net_after_charges.toFixed(2)}</span>
          </span>
          <span className="inline-flex items-center gap-1 bg-dark-900 px-2.5 py-1 rounded-lg text-[11px]">
            <Zap size={10} className="text-amber-400" />
            <span className="text-gray-400">Break-even</span>
            <span className="font-bold text-white">{s.breakeven_pct}%</span>
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <ArrowRight size={12} className="text-white" />
          <span className="text-sm font-bold">{s.message}</span>
        </div>

        <div className="mt-3 inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold">
          <Zap size={12} />
          Buy in Angel One
        </div>
      </div>
    </div>
  )
}
