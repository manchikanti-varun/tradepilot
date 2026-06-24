import { useState, useEffect } from 'react'
import { api } from '../api'
import { Radio, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'

export default function WatchlistPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    api.watchlist().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  return (
    <div className="py-3">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Radio size={18} className="text-accent-blue" /> Watchlist
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data ? `${data.total} stocks scored • Tier ${data.tier}` : 'Loading...'}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-dark-700 border border-dark-600 hover:border-accent-blue transition-colors">
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {data?.stocks?.length > 0 ? (
        <div className="space-y-1.5">
          {data.stocks.map((s, i) => (
            <div key={s.symbol} className="flex items-center justify-between bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 hover:border-dark-500 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                <div>
                  <div className="font-bold text-sm">{s.symbol}</div>
                  <div className="text-[10px] text-gray-500">{s.sector}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-semibold">₹{s.ltp?.toFixed(2)}</div>
                  <div className="text-[10px] text-gray-500">RSI {s.rsi?.toFixed(0)}</div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  s.grade === 'A+' ? 'bg-accent-green/15 text-accent-green' :
                  s.grade === 'A' ? 'bg-accent-blue/15 text-accent-blue' :
                  s.grade === 'B' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-dark-600 text-gray-500'
                }`}>
                  {s.grade}
                </div>
                {s.volume_ratio > 1.2 ? <TrendingUp size={12} className="text-accent-green" /> :
                 s.volume_ratio < 0.8 ? <TrendingDown size={12} className="text-accent-red" /> :
                 <Minus size={12} className="text-gray-600" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Radio size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No watchlist data yet</p>
          <p className="text-xs mt-1">Watchlist builds at 8:15 AM on market days</p>
        </div>
      )}
    </div>
  )
}
