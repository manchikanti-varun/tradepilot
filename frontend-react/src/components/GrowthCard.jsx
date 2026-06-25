import { Wallet, ChevronRight } from 'lucide-react'

const TIERS = { A: [1000, 2000], B: [2000, 5000], C: [5000, 10000], D: [10000, 100000] }

export default function GrowthCard({ growth }) {
  const range = TIERS[growth.current_tier] || [1000, 2000]

  return (
    <div className="bg-gradient-to-br from-blue-950/60 to-dark-700 border border-blue-500/20 rounded-2xl p-5 mb-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-accent-blue" />
            <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Capital</span>
          </div>
          <div className="text-2xl font-extrabold tracking-tight">
            ₹{growth.current_capital.toLocaleString('en-IN')}
          </div>
          <div className="inline-flex items-center gap-1 bg-blue-500/15 text-accent-blue px-2 py-0.5 rounded-md text-[11px] font-bold mt-1.5">
            TIER {growth.current_tier}
            <ChevronRight size={10} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 font-medium">{growth.progress_pct_to_next_tier.toFixed(0)}%</div>
          <div className="text-[10px] text-gray-500">to Tier {growth.current_tier === 'D' ? 'MAX' : String.fromCharCode(growth.current_tier.charCodeAt(0) + 1)}</div>
        </div>
      </div>
      <div className="h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-accent-blue to-cyan-400 rounded-full transition-all duration-700"
          style={{ width: `${growth.progress_pct_to_next_tier}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-gray-600">
        <span>₹{range[0].toLocaleString()}</span>
        <span>₹{range[1].toLocaleString()}</span>
      </div>
    </div>
  )
}
