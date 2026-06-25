import { useState, useEffect } from 'react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { api } from '../api'

export default function Week52Card() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.week52().then(setData).catch(() => {})
  }, [])

  if (!data || (!data.near_high?.length && !data.near_low?.length)) return null

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-4 mb-3">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">52-Week Levels</p>

      {data.near_high?.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUpCircle size={11} className="text-green-400" />
            <span className="text-[9px] text-green-400 font-bold">NEAR 52W HIGH</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {data.near_high.slice(0, 5).map(s => (
              <span key={s.symbol} className="bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 text-[10px]">
                <span className="font-bold text-white">{s.symbol}</span>
                <span className="text-green-400 ml-1">{s.pct_away}% away</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {data.near_low?.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowDownCircle size={11} className="text-red-400" />
            <span className="text-[9px] text-red-400 font-bold">NEAR 52W LOW</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {data.near_low.slice(0, 5).map(s => (
              <span key={s.symbol} className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 text-[10px]">
                <span className="font-bold text-white">{s.symbol}</span>
                <span className="text-red-400 ml-1">{s.pct_away}% above</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
