import { useState, useEffect } from 'react'
import { Grid3X3, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../api'

const MOOD_COLORS = {
  POSITIVE: 'bg-green-500/15 border-green-500/30 text-green-400',
  NEGATIVE: 'bg-red-500/15 border-red-500/30 text-red-400',
  NEUTRAL: 'bg-dark-600 border-dark-500 text-gray-400',
}

export default function MarketOverview() {
  const [sectors, setSectors] = useState(null)
  const [movers, setMovers] = useState(null)
  const [tab, setTab] = useState('sectors') // 'sectors' | 'gainers' | 'losers'

  useEffect(() => {
    api.sectors().then(setSectors).catch(() => {})
    api.movers().then(setMovers).catch(() => {})
    const interval = setInterval(() => {
      api.sectors().then(setSectors).catch(() => {})
      api.movers().then(setMovers).catch(() => {})
    }, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-4 mb-3">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        <TabBtn active={tab === 'sectors'} onClick={() => setTab('sectors')} icon={Grid3X3} label="Sectors" />
        <TabBtn active={tab === 'gainers'} onClick={() => setTab('gainers')} icon={TrendingUp} label="Gainers" />
        <TabBtn active={tab === 'losers'} onClick={() => setTab('losers')} icon={TrendingDown} label="Losers" />
      </div>

      {/* Sector Heatmap */}
      {tab === 'sectors' && sectors?.sectors && (
        <div className="grid grid-cols-3 gap-1.5">
          {sectors.sectors.slice(0, 9).map(s => {
            const colors = MOOD_COLORS[s.mood] || MOOD_COLORS.NEUTRAL
            return (
              <div key={s.sector} className={`border rounded-lg p-2 text-center ${colors}`}>
                <p className="text-[9px] font-bold truncate">{s.sector}</p>
                <p className="text-[10px] font-mono mt-0.5">
                  {s.gainers > s.losers ? '↑' : s.losers > s.gainers ? '↓' : '—'}
                  {' '}{s.avg_score.toFixed(0)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Gainers */}
      {tab === 'gainers' && movers?.gainers && (
        <div className="space-y-1.5">
          {movers.gainers.map((s, i) => (
            <div key={s.symbol} className="flex items-center justify-between bg-dark-900 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                <span className="text-xs font-bold text-white">{s.symbol}</span>
                <span className="text-[10px] text-gray-500">{s.sector}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-white">₹{s.ltp.toFixed(1)}</span>
                <span className="text-[10px] ml-2 text-green-400 font-bold">{s.grade}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Losers */}
      {tab === 'losers' && movers?.losers && (
        <div className="space-y-1.5">
          {movers.losers.map((s, i) => (
            <div key={s.symbol} className="flex items-center justify-between bg-dark-900 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-4">{i + 1}</span>
                <span className="text-xs font-bold text-white">{s.symbol}</span>
                <span className="text-[10px] text-gray-500">{s.sector}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-white">₹{s.ltp.toFixed(1)}</span>
                <span className="text-[10px] ml-2 text-red-400 font-bold">{s.grade}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!sectors?.sectors?.length && !movers?.gainers?.length && (
        <p className="text-[11px] text-gray-600 text-center py-4">Waiting for first scan...</p>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
        active ? 'bg-accent-blue/20 text-accent-blue' : 'text-gray-500 hover:text-gray-300'
      }`}>
      <Icon size={11} />
      {label}
    </button>
  )
}
