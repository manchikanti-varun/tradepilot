import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Zap, Target, Volume2, RefreshCw } from 'lucide-react'
import { api } from '../api'
import StockDetailModal from '../components/StockDetailModal'

const TABS = [
  { id: 'bullish', label: 'Bullish', icon: TrendingUp, color: 'text-green-400' },
  { id: 'bearish', label: 'Bearish', icon: TrendingDown, color: 'text-red-400' },
  { id: 'breakout', label: 'Breakout', icon: Zap, color: 'text-amber-400' },
  { id: 'oversold', label: 'Oversold', icon: Target, color: 'text-blue-400' },
  { id: 'high_volume', label: 'Volume', icon: Volume2, color: 'text-purple-400' },
]

export default function ScreenerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('bullish')
  const [selectedStock, setSelectedStock] = useState(null)

  const fetchData = () => {
    setLoading(true)
    api.screener().then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const stocks = data?.[tab] || []

  return (
    <div className="py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Screener</h2>
        <button onClick={fetchData} className="p-1.5 rounded-lg bg-dark-700">
          <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          const count = data?.[t.id]?.length || 0
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                tab === t.id ? `bg-dark-600 ${t.color}` : 'bg-dark-700 text-gray-500'
              }`}>
              <Icon size={11} />
              {t.label}
              {count > 0 && <span className="bg-dark-900 px-1 rounded text-[8px]">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Description */}
      <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2">
        <p className="text-[10px] text-gray-400">
          {tab === 'bullish' && 'Stocks with all bullish signals: EMA9 > EMA21, MACD positive, price above VWAP. Strong uptrend.'}
          {tab === 'bearish' && 'Stocks in downtrend: EMA bearish crossover, negative MACD, below VWAP. Avoid buying these.'}
          {tab === 'breakout' && 'Stocks breaking day high with above-average volume. Momentum entry opportunities.'}
          {tab === 'oversold' && 'RSI below 35 — heavily sold off. Could bounce back. Wait for confirmation before buying.'}
          {tab === 'high_volume' && 'Unusual volume activity (2x+ average). Something is happening — check news.'}
        </p>
      </div>

      {/* Stock List */}
      {loading && !data ? (
        <div className="text-center py-12">
          <RefreshCw size={18} className="animate-spin text-gray-500 mx-auto" />
        </div>
      ) : stocks.length > 0 ? (
        <div className="space-y-2">
          {stocks.map((s, i) => (
            <button key={s.symbol} onClick={() => setSelectedStock(s.symbol)}
              className="w-full bg-dark-700 border border-dark-600 rounded-xl p-3 text-left hover:border-accent-blue/30 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{s.symbol}</span>
                  <span className="text-[9px] text-gray-500">{s.sector}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white">₹{s.ltp}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    s.grade === 'A+' || s.grade === 'A' ? 'bg-green-500/15 text-green-400' :
                    s.grade === 'B' ? 'bg-amber-500/15 text-amber-400' : 'bg-dark-600 text-gray-500'
                  }`}>{s.grade}</span>
                </div>
              </div>
              {/* Reason */}
              <p className="text-[10px] text-gray-400 leading-relaxed">{s.reason}</p>
              {/* Mini stats */}
              <div className="flex gap-3 mt-1.5 text-[9px] text-gray-500">
                <span>RSI {s.rsi}</span>
                <span>MACD {s.macd}</span>
                <span>VWAP {s.vwap_relation}</span>
                <span>Vol {s.volume_ratio}x</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xs text-gray-500">No stocks match this filter right now</p>
          <p className="text-[10px] text-gray-600 mt-1">Screener updates with every scan (every 3 min)</p>
        </div>
      )}

      {/* Scanned count */}
      {data && (
        <p className="text-[9px] text-gray-600 text-center">
          {data.total_scanned} stocks scanned {data.last_scan ? `• Last: ${data.last_scan.slice(11, 16)}` : ''}
        </p>
      )}

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal symbol={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}
