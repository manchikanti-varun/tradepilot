import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Flame, ChevronRight, Circle, ArrowUp, ArrowDown } from 'lucide-react'
import { api } from '../api'
import StockDetailModal from '../components/StockDetailModal'

const STRENGTH_CONFIG = {
  STRONG: { label: 'Strong', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30', icon: Flame },
  MEDIUM: { label: 'Medium', color: 'text-accent-blue', bg: 'bg-accent-blue/15 border-accent-blue/30', icon: ChevronRight },
  MILD: { label: 'Mild', color: 'text-gray-400', bg: 'bg-dark-600 border-dark-500', icon: Circle },
}

export default function ScreenerPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('bullish')
  const [selectedStock, setSelectedStock] = useState(null)

  const fetchData = () => {
    setLoading(true)
    api.screener().then(setData).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const stocks = data?.[view] || []
  const bullCount = data?.bullish?.length || 0
  const bearCount = data?.bearish?.length || 0

  return (
    <div className="py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Screener</h2>
          <p className="text-[10px] text-gray-500">KST crossover signals — multi-timeframe</p>
        </div>
        <button onClick={fetchData} className="p-1.5 rounded-lg bg-dark-700">
          <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* How it works */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-3">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="text-white font-medium">Hourly KST crossover</span> triggers the signal.{' '}
          <span className="text-white font-medium">Daily + Weekly</span> trends determine strength.
          All three aligned = strongest signal.
        </p>
      </div>

      {/* Bull/Bear Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('bullish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
            view === 'bullish' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-dark-700 border-dark-600 text-gray-500'
          }`}>
          <TrendingUp size={14} />
          Bullish ({bullCount})
        </button>
        <button onClick={() => setView('bearish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
            view === 'bearish' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-dark-700 border-dark-600 text-gray-500'
          }`}>
          <TrendingDown size={14} />
          Bearish ({bearCount})
        </button>
      </div>

      {/* Stock List */}
      {loading && !data ? (
        <div className="text-center py-12">
          <RefreshCw size={18} className="animate-spin text-gray-500 mx-auto" />
        </div>
      ) : stocks.length > 0 ? (
        <div className="space-y-2">
          {stocks.map((s) => {
            const cfg = STRENGTH_CONFIG[s.strength] || STRENGTH_CONFIG.MILD
            const StrengthIcon = cfg.icon
            return (
              <button key={s.symbol} onClick={() => setSelectedStock(s.symbol)}
                className="w-full bg-dark-700 border border-dark-600 rounded-xl p-3.5 text-left hover:border-accent-blue/30 transition-colors">

                {/* Row 1: Symbol + Strength Badge + Price */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{s.symbol}</span>
                    <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg}`}>
                      <StrengthIcon size={8} className={cfg.color} />
                      <span className={cfg.color}>{cfg.label}</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono text-white">₹{s.ltp}</span>
                </div>

                {/* Row 2: Timeframe alignment */}
                <div className="flex items-center gap-3 mb-1.5">
                  <TimeframeChip label="1H" direction={s.hourly} isTrigger />
                  <TimeframeChip label="1D" direction={s.daily} />
                  <TimeframeChip label="1W" direction={s.weekly} />
                  <span className="text-[9px] text-gray-500 ml-auto">RSI {s.rsi}</span>
                </div>

                {/* Row 3: Reason */}
                <p className="text-[10px] text-gray-400 leading-relaxed">{s.reason}</p>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xs text-gray-500">No KST crossover signals right now</p>
          <p className="text-[10px] text-gray-600 mt-1">Signals appear when hourly KST crosses its signal line</p>
        </div>
      )}

      {/* Footer */}
      {data && (
        <p className="text-[9px] text-gray-600 text-center">
          {data.total_scanned} stocks scanned {data.last_scan ? `at ${data.last_scan.slice(11, 16)}` : ''}
        </p>
      )}

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal symbol={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}

function TimeframeChip({ label, direction, isTrigger = false }) {
  const isBull = direction === 'BULLISH'
  const Icon = isBull ? ArrowUp : ArrowDown
  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
      isTrigger ? 'border' : ''
    } ${
      isBull
        ? `bg-green-500/10 text-green-400 ${isTrigger ? 'border-green-500/40' : ''}`
        : direction === 'NEUTRAL'
          ? 'bg-dark-600 text-gray-500'
          : `bg-red-500/10 text-red-400 ${isTrigger ? 'border-red-500/40' : ''}`
    }`}>
      <Icon size={8} />
      <span>{label}</span>
    </div>
  )
}
