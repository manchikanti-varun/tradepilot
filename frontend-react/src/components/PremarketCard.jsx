import { useState, useEffect } from 'react'
import { Sunrise, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../api'

export default function PremarketCard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.premarket().then(setData).catch(() => {})
  }, [])

  if (!data || (!data.gap_ups?.length && !data.gap_downs?.length)) return null

  return (
    <div className="bg-dark-700 border border-amber-500/20 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Sunrise size={14} className="text-amber-400" />
        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Gap Scanner</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Gap Ups */}
        <div>
          <p className="text-[9px] text-green-400 font-bold mb-1.5">↑ GAP UP</p>
          {data.gap_ups?.slice(0, 3).map(s => (
            <div key={s.symbol} className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-white">{s.symbol}</span>
              <span className="text-[10px] text-green-400 font-mono">+{s.gap_pct}%</span>
            </div>
          ))}
          {!data.gap_ups?.length && <p className="text-[9px] text-gray-600">None</p>}
        </div>

        {/* Gap Downs */}
        <div>
          <p className="text-[9px] text-red-400 font-bold mb-1.5">↓ GAP DOWN</p>
          {data.gap_downs?.slice(0, 3).map(s => (
            <div key={s.symbol} className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-white">{s.symbol}</span>
              <span className="text-[10px] text-red-400 font-mono">{s.gap_pct}%</span>
            </div>
          ))}
          {!data.gap_downs?.length && <p className="text-[9px] text-gray-600">None</p>}
        </div>
      </div>
    </div>
  )
}
