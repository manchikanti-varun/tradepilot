import { useState, useEffect } from 'react'
import { api, formatTime, formatCurrency } from '../api'
import { History, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'

export default function HistoryPage() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.history(50).then(d => { setTrades(d.trades || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-12 text-center text-gray-500 text-sm">Loading trades...</div>

  return (
    <div className="py-3">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <History size={18} className="text-accent-blue" /> Trade History
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">{trades.length} trades recorded</p>
      </div>

      {trades.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No trades yet</p>
          <p className="text-xs mt-1">Report your first trade using the input on the Home tab</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map(t => {
            const isProfit = t.exit_price && t.exit_price > t.entry_price
            const isClosed = t.status === 'CLOSED'
            return (
              <div key={t.id} className="bg-dark-700 border border-dark-600 rounded-xl px-4 py-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {isClosed ? (
                      isProfit ? <ArrowUpRight size={16} className="text-accent-green" />
                               : <ArrowDownRight size={16} className="text-accent-red" />
                    ) : (
                      <Clock size={16} className="text-accent-blue animate-pulse" />
                    )}
                    <div>
                      <span className="font-bold text-sm">{t.ticker}</span>
                      <span className="ml-2 text-[10px] bg-dark-600 px-1.5 py-0.5 rounded text-gray-400">
                        Tier {t.capital_tier}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {isClosed ? (
                      <span className={`font-bold text-sm ${isProfit ? 'text-accent-green' : 'text-accent-red'}`}>
                        ₹{t.entry_price} → ₹{t.exit_price}
                      </span>
                    ) : (
                      <span className="text-accent-blue text-sm font-bold">OPEN</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
                  <span>Qty {t.qty} • {formatTime(t.entry_time)}</span>
                  {t.exit_time && <span>{formatTime(t.exit_time)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
