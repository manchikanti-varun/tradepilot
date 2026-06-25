import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Flame, ChevronRight, Circle, Zap } from 'lucide-react'
import { api } from '../api'
import StockDetailModal from '../components/StockDetailModal'

const TIMEFRAMES = [
  { key: '5m', label: '5 Min' },
  { key: '15m', label: '15 Min' },
  { key: '1h', label: '1 Hour' },
  { key: '1d', label: '1 Day' },
  { key: '1w', label: '1 Week' },
]

const STRENGTH_ICON = { STRONG: Flame, MEDIUM: ChevronRight, MILD: Circle }

export default function ScreenerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('1h')
  const [view, setView] = useState('bullish')
  const [selectedStock, setSelectedStock] = useState(null)

  const fetchData = (tf) => {
    setLoading(true)
    api.screenerTimeframe(tf || timeframe).then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const changeTimeframe = (tf) => {
    setTimeframe(tf)
    fetchData(tf)
  }

  const stocks = data?.[view] || []
  const bullCount = data?.bullish?.length || 0
  const bearCount = data?.bearish?.length || 0
  const kstSignals = data?.kst_signals || []

  return (
    <div className="py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Screener</h2>
        <button onClick={() => fetchData()} className="p-1.5 rounded-lg bg-dark-700">
          <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-xl p-1">
        {TIMEFRAMES.map(tf => (
          <button key={tf.key} onClick={() => changeTimeframe(tf.key)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-colors ${
              timeframe === tf.key ? 'bg-accent-blue text-white' : 'text-gray-500'
            }`}>
            {tf.label}
          </button>
        ))}
      </div>

      {/* Bullish / Bearish Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('bullish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border ${
            view === 'bullish' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-500'
          }`}>
          <TrendingUp size={13} /> Bullish ({bullCount})
        </button>
        <button onClick={() => setView('bearish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border ${
            view === 'bearish' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-dark-700 border-dark-600 text-gray-500'
          }`}>
          <TrendingDown size={13} /> Bearish ({bearCount})
        </button>
      </div>

      {/* Stock List */}
      {loading && !data ? (
        <div className="text-center py-8">
          <RefreshCw size={16} className="animate-spin text-gray-500 mx-auto" />
        </div>
      ) : stocks.length > 0 ? (
        <div className="space-y-1.5">
          {stocks.map(s => {
            const SIcon = STRENGTH_ICON[s.strength] || Circle
            return (
              <button key={s.symbol} onClick={() => setSelectedStock(s.symbol)}
                className="w-full flex items-center justify-between bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-left hover:border-accent-blue/30">
                <div className="flex items-center gap-2">
                  <SIcon size={10} className={s.strength === 'STRONG' ? 'text-green-400' : s.strength === 'MEDIUM' ? 'text-accent-blue' : 'text-gray-500'} />
                  <div>
                    <span className="text-xs font-bold text-white">{s.symbol}</span>
                    <span className="text-[9px] text-gray-500 ml-1.5">{s.sector}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white">₹{s.ltp}</span>
                  <span className={`text-[10px] font-bold ${s.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-8">No stocks for this timeframe</p>
      )}

      {/* KST Signals Section */}
      {kstSignals.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-amber-400" />
            <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">KST Crossover Signals</span>
          </div>
          <div className="space-y-1.5">
            {kstSignals.map((s, i) => (
              <button key={i} onClick={() => setSelectedStock(s.symbol)}
                className={`w-full rounded-xl px-3 py-2.5 text-left border ${
                  s.kst_direction === 'BULLISH' ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{s.symbol}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    s.kst_direction === 'BULLISH' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>{s.kst_direction}</span>
                </div>
                <p className="text-[9px] text-gray-400">{s.kst_reason}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {data && (
        <p className="text-[9px] text-gray-600 text-center">
          {data.total_scanned} stocks • {timeframe} timeframe
        </p>
      )}

      {/* Stock Detail */}
      {selectedStock && (
        <StockDetailModal symbol={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}
