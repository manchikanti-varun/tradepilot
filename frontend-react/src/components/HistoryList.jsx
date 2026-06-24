import { useState, useEffect } from 'react'
import { api, formatTime } from '../api'

export default function HistoryList() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.history(30).then(d => { setTrades(d.trades || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-8 text-gray-500 text-sm">Loading...</div>

  if (!trades.length) {
    return (
      <div className="bg-dark-700 border border-dark-600 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">📝</div>
        <p className="text-gray-400 text-sm">No trades yet</p>
        <p className="text-gray-500 text-xs mt-1">Report your first trade in the input above</p>
      </div>
    )
  }

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">Recent Trades</p>
      <div className="space-y-0">
        {trades.map(t => {
          const isProfit = t.exit_price && t.exit_price > t.entry_price
          return (
            <div key={t.id} className="flex justify-between items-center py-3 border-b border-dark-600 last:border-0">
              <div>
                <div className="font-bold text-sm">{t.ticker}</div>
                <div className="text-[11px] text-gray-500">
                  {formatTime(t.entry_time)} • Qty {t.qty} • Tier {t.capital_tier}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold text-sm ${
                  t.exit_price ? (isProfit ? 'text-accent-green' : 'text-accent-red') : 'text-accent-blue'
                }`}>
                  {t.exit_price ? `₹${t.entry_price} → ₹${t.exit_price}` : 'OPEN'}
                </div>
                <div className="text-[10px] text-gray-500">
                  {t.exit_time ? formatTime(t.exit_time) : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
