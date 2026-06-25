import { Sun, Star, Shield, TrendingUp, TrendingDown, CloudRain, Cloud, CloudSun, Target, DollarSign, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '../api'
import { useState } from 'react'
import StockDetailModal from './StockDetailModal'

export default function BriefCard({ brief }) {
  const [selectedStock, setSelectedStock] = useState(null)

  if (!brief) return null

  const cap = brief.capital_snapshot
  const capital = cap?.current_capital || 0
  const vix = brief.vix || 0
  const mood = brief.news_mood || 'NEUTRAL'
  const riskMode = brief.risk_state?.mode || 'GO'

  // Calculate investment suggestion based on market conditions
  let investPct = 100
  let investAmount = capital
  let riskLevel = 'LOW'
  let suggestion = ''
  let expectedRange = { min: 0, max: 0 }

  if (riskMode === 'HARD_STOP') {
    // Check if it's just time-based (after market close) or actual danger
    const isTimeStop = brief.risk_state?.reason_if_not_go?.includes('15:10') || brief.risk_state?.reason_if_not_go?.includes('after')
    if (isTimeStop) {
      investPct = 0
      investAmount = 0
      riskLevel = 'LOW'
      suggestion = "Market is closed. Plan for tomorrow — review today's top picks."
    } else {
      investPct = 0
      investAmount = 0
      riskLevel = 'HIGH'
      suggestion = "Risk manager halted trading. Wait for conditions to improve."
    }
  } else if (vix > 22) {
    investPct = 0
    investAmount = 0
    riskLevel = 'HIGH'
    suggestion = "VIX is very high. Market is too volatile. Stay out today."
  } else if (vix > 17 || mood === 'BEARISH') {
    investPct = 50
    investAmount = capital * 0.5
    riskLevel = 'MEDIUM'
    suggestion = "Market is risky. Invest only half your capital with tight stop loss."
  } else if (mood === 'BULLISH' && vix < 15) {
    investPct = 100
    investAmount = capital
    riskLevel = 'LOW'
    suggestion = "Market looks good. You can trade with full capital today."
  } else {
    investPct = 75
    investAmount = capital * 0.75
    riskLevel = 'LOW'
    suggestion = "Normal market. Trade with confidence but keep a stop loss."
  }

  // Expected profit/loss range (based on ATR average ~1% move, 5x leverage)
  const leverage = 5
  const exposure = investAmount * leverage
  const avgMovePct = vix > 17 ? 1.5 : 0.8 // higher move in volatile market
  expectedRange = {
    profit: Math.round(exposure * avgMovePct / 100),
    loss: Math.round(exposure * avgMovePct / 100 * 0.4), // stop loss at 40% of move
  }

  const riskColors = {
    LOW: 'text-green-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-red-400',
  }

  return (
    <div className="bg-gradient-to-br from-dark-700 to-dark-800 border border-dark-600 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sun size={13} className="text-purple-400" />
          <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Today's Plan</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          riskLevel === 'LOW' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          riskLevel === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
          'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>{riskLevel} RISK</span>
      </div>

      {/* Main Suggestion */}
      <p className="text-sm text-white font-medium leading-relaxed mb-3">{suggestion}</p>

      {/* Investment Plan */}
      {investPct > 0 && (
        <div className="bg-dark-900/60 rounded-xl p-3 mb-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs font-bold text-accent-blue">{formatCurrency(investAmount)}</p>
              <p className="text-[8px] text-gray-500 uppercase mt-0.5">Invest Today</p>
              <p className="text-[9px] text-gray-600">{investPct}% of capital</p>
            </div>
            <div>
              <p className="text-xs font-bold text-green-400">+{formatCurrency(expectedRange.profit)}</p>
              <p className="text-[8px] text-gray-500 uppercase mt-0.5">Can Gain</p>
              <p className="text-[9px] text-gray-600">if trade works</p>
            </div>
            <div>
              <p className="text-xs font-bold text-red-400">-{formatCurrency(expectedRange.loss)}</p>
              <p className="text-[8px] text-gray-500 uppercase mt-0.5">Max Loss</p>
              <p className="text-[9px] text-gray-600">with stop loss</p>
            </div>
          </div>
        </div>
      )}

      {/* Market Conditions */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span>VIX: <span className={vix > 22 ? 'text-red-400 font-bold' : vix > 17 ? 'text-amber-400 font-bold' : 'text-green-400 font-bold'}>{vix.toFixed(1)}</span></span>
        <span className="text-dark-600">|</span>
        <span>Mood: <span className={mood === 'BULLISH' ? 'text-green-400 font-bold' : mood === 'BEARISH' ? 'text-red-400 font-bold' : 'text-gray-300 font-bold'}>
          {mood === 'BULLISH' ? 'Positive' : mood === 'BEARISH' ? 'Negative' : 'Neutral'}
        </span></span>
        <span className="text-dark-600">|</span>
        <span>Stocks: <span className="text-white font-bold">{brief.watchlist_summary?.total_candidates || 0}</span></span>
      </div>

      {/* Top Stocks to Watch — clickable */}
      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span className="text-[9px] text-gray-500">Top picks:</span>
          {brief.watchlist_summary.top_3_by_score.map(s => (
            <button key={s.ticker} onClick={() => setSelectedStock(s.ticker)}
              className="inline-flex items-center gap-1 bg-dark-900 px-2 py-1 rounded text-[10px] hover:bg-dark-800 active:scale-95 transition-all">
              <Star size={7} className="text-accent-green" />
              <span className="text-white font-medium">{s.ticker}</span>
            </button>
          ))}
        </div>
      )}

      {/* Events Warning */}
      {brief.event_calendar_today?.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <AlertTriangle size={10} className="text-amber-400" />
          <span className="text-[9px] text-amber-300">{brief.event_calendar_today.map(e => e.event).join(' | ')}</span>
        </div>
      )}

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailModal symbol={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  )
}
