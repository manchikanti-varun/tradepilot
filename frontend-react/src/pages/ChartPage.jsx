import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api } from '../api'

const INTERVALS = [
  { key: '5m', label: '5min' },
  { key: '15m', label: '15min' },
  { key: '1h', label: '1H' },
  { key: '1d', label: 'Daily' },
]

export default function ChartPage({ symbol: initialSymbol }) {
  const [symbol, setSymbol] = useState(initialSymbol || 'RELIANCE')
  const [interval, setInterval] = useState('5m')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [inputSymbol, setInputSymbol] = useState(initialSymbol || 'RELIANCE')

  const fetchChart = async () => {
    setLoading(true)
    try {
      const res = await api.chart(symbol, interval)
      setData(res)
    } catch (e) {
      console.error('Chart fetch failed', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchChart() }, [symbol, interval])

  const handleSymbolSubmit = (e) => {
    e.preventDefault()
    setSymbol(inputSymbol.toUpperCase().trim())
  }

  // Transform candle data for display
  const chartData = (data?.candles || []).slice(-80).map(c => ({
    time: c.time?.slice(11, 16) || c.time?.slice(5, 10) || '',
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
    // For bar coloring
    bullish: c.close >= c.open,
    body: Math.abs(c.close - c.open),
    bodyBase: Math.min(c.open, c.close),
  }))

  const lastCandle = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const firstCandle = chartData.length > 0 ? chartData[0] : null
  const priceChange = lastCandle && firstCandle ? lastCandle.close - firstCandle.open : 0
  const pctChange = firstCandle && firstCandle.open > 0 ? (priceChange / firstCandle.open * 100) : 0

  return (
    <div className="py-4">
      {/* Symbol Input */}
      <form onSubmit={handleSymbolSubmit} className="flex gap-2 mb-3">
        <input value={inputSymbol} onChange={e => setInputSymbol(e.target.value.toUpperCase())}
          placeholder="Enter symbol (e.g. SBIN)"
          className="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-accent-blue"
        />
        <button type="submit" className="px-4 py-2.5 bg-accent-blue text-white rounded-xl text-xs font-bold">
          Load
        </button>
      </form>

      {/* Symbol Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-extrabold">{symbol}</h2>
          {lastCandle && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono">₹{lastCandle.close.toFixed(2)}</span>
              <span className={`text-xs font-bold ${pctChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <button onClick={fetchChart} className="p-2 rounded-lg bg-dark-700">
          <RefreshCw size={13} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Interval Tabs */}
      <div className="flex gap-1 mb-3">
        {INTERVALS.map(({ key, label }) => (
          <button key={key} onClick={() => setInterval(key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${
              interval === key ? 'bg-accent-blue text-white' : 'bg-dark-700 text-gray-500'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Price Chart */}
      {chartData.length > 0 ? (
        <>
          <div className="bg-dark-700 border border-dark-600 rounded-xl p-3 mb-3">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData}>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#6b7280' }} tickLine={false} axisLine={false}
                  interval={Math.floor(chartData.length / 6)} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#6b7280' }}
                  tickLine={false} axisLine={false} width={50} tickFormatter={v => `₹${v}`} />
                <Tooltip content={<CandleTooltip />} />
                <Line type="monotone" dataKey="close" stroke="#2196F3" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="high" stroke="#4ade8033" strokeWidth={0.5} dot={false} />
                <Line type="monotone" dataKey="low" stroke="#f8717133" strokeWidth={0.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Chart */}
          <div className="bg-dark-700 border border-dark-600 rounded-xl p-3">
            <p className="text-[9px] text-gray-500 mb-2">VOLUME</p>
            <ResponsiveContainer width="100%" height={60}>
              <ComposedChart data={chartData}>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.bullish ? '#4ade8040' : '#f8717140'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="bg-dark-700 border border-dark-600 rounded-xl p-12 text-center">
          <BarChart3 size={28} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">{loading ? 'Loading chart...' : 'No data available'}</p>
        </div>
      )}

      {/* Info */}
      <p className="text-[10px] text-gray-600 text-center mt-3">
        {data?.count || 0} candles • {interval} interval • Real-time from Angel One
      </p>
    </div>
  )
}

function CandleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-[10px]">
      <p className="text-gray-500">{d.time}</p>
      <div className="grid grid-cols-2 gap-x-3 mt-1">
        <span className="text-gray-400">O: <span className="text-white">₹{d.open?.toFixed(1)}</span></span>
        <span className="text-gray-400">H: <span className="text-green-400">₹{d.high?.toFixed(1)}</span></span>
        <span className="text-gray-400">L: <span className="text-red-400">₹{d.low?.toFixed(1)}</span></span>
        <span className="text-gray-400">C: <span className="text-white">₹{d.close?.toFixed(1)}</span></span>
      </div>
      <p className="text-gray-500 mt-1">Vol: {d.volume?.toLocaleString()}</p>
    </div>
  )
}
