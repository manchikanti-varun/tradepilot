import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, BarChart3, Brain, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { api, formatCurrency } from '../api'

const TREND_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Bullish' },
  BEARISH: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Bearish' },
  SIDEWAYS: { icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Sideways' },
}

const VERDICT_CONFIG = {
  CONFIRMED_BUY: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Both AIs say BUY', icon: CheckCircle2 },
  LIKELY_BUY: { color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/30', label: 'AI suggests BUY', icon: TrendingUp },
  CONFIRMED_WAIT: { color: 'text-gray-400', bg: 'bg-dark-600 border-dark-500', label: 'AIs say WAIT', icon: Minus },
  CONFLICTING: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'AIs disagree — skip', icon: AlertTriangle },
  NO_SIGNAL: { color: 'text-gray-500', bg: 'bg-dark-600 border-dark-500', label: 'No clear signal', icon: Minus },
}

export default function StockDetailModal({ symbol, onClose }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    api.stockPlan(symbol)
      .then(setPlan)
      .catch(() => setError('Could not load data'))
      .finally(() => setLoading(false))
  }, [symbol])

  if (!symbol) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-[1001] flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-dark-800 border-t border-dark-600 rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-extrabold">{symbol}</h2>
            {plan && <p className="text-xs text-gray-500">{plan.sector} • ₹{plan.ltp?.toFixed(2)}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-dark-700">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-xs text-gray-400">AI is analyzing...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-5 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {plan && !loading && (
          <div className="p-5 space-y-4">

            {/* AI Verdict */}
            {plan.ai_analysis && (() => {
              const v = VERDICT_CONFIG[plan.ai_analysis.verdict] || VERDICT_CONFIG.NO_SIGNAL
              const VIcon = v.icon
              return (
                <div className={`border rounded-xl p-4 ${v.bg}`}>
                  {/* Final Verdict */}
                  <div className="flex items-center gap-2 mb-3">
                    <VIcon size={18} className={v.color} />
                    <span className={`text-sm font-bold ${v.color}`}>{v.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                      plan.ai_analysis.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                      plan.ai_analysis.confidence === 'MEDIUM' ? 'bg-accent-blue/20 text-accent-blue' :
                      'bg-dark-600 text-gray-500'
                    }`}>{plan.ai_analysis.confidence} confidence</span>
                  </div>

                  {/* Cerebras Opinion */}
                  <div className="bg-dark-900/50 rounded-lg p-2.5 mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-bold text-blue-400">CEREBRAS</span>
                      {plan.ai_analysis.gemini_says
                        ? <span className="text-[9px] text-gray-500 ml-auto">responded</span>
                        : <span className="text-[9px] text-red-400 ml-auto">unavailable</span>
                      }
                    </div>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      {plan.ai_analysis.gemini_says || "Cerebras did not respond — using Groq only"}
                    </p>
                  </div>

                  {/* Groq Opinion */}
                  <div className="bg-dark-900/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-[9px] font-bold text-orange-400">GROQ</span>
                      {plan.ai_analysis.groq_says
                        ? <span className="text-[9px] text-gray-500 ml-auto">responded</span>
                        : <span className="text-[9px] text-red-400 ml-auto">unavailable</span>
                      }
                    </div>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      {plan.ai_analysis.groq_says || "Groq did not respond — using Cerebras only"}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Trend */}
            {(() => {
              const t = TREND_CONFIG[plan.trend] || TREND_CONFIG.SIDEWAYS
              const TIcon = t.icon
              return (
                <div className={`${t.bg} border border-current/20 rounded-xl p-3 ${t.color}`}>
                  <div className="flex items-center gap-2">
                    <TIcon size={14} />
                    <span className="text-xs font-bold">{t.label}</span>
                  </div>
                  <p className="text-[10px] opacity-80 mt-1">{plan.trend_description}</p>
                </div>
              )
            })()}

            {/* Trading Plan */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Target size={13} className="text-accent-blue" /> Trading Plan
              </h3>
              <div className="space-y-2.5">
                <PlanRow label="Entry" value={`₹${plan.entry_price}`} color="text-accent-blue" />
                <PlanRow label="Stop Loss" value={`₹${plan.stop_loss}`} color="text-red-400"
                  sub={`Risk ₹${plan.risk_per_share}/share`} />
                {plan.targets?.map(t => (
                  <PlanRow key={t.level} label={t.label} value={`₹${t.price}`} color="text-green-400" />
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-dark-600">
                  <span className="text-[10px] text-gray-400">Risk : Reward</span>
                  <span className={`text-sm font-bold ${plan.risk_reward >= 1.5 ? 'text-green-400' : plan.risk_reward >= 1 ? 'text-accent-blue' : 'text-red-400'}`}>
                    1 : {plan.risk_reward}
                  </span>
                </div>
              </div>
            </div>

            {/* Position Size */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Zap size={13} className="text-amber-400" /> Position Size
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="Qty" value={plan.suggested_qty} />
                <MiniCard label="Capital" value={formatCurrency(plan.capital_required)} />
                <MiniCard label="Charges" value={formatCurrency(plan.estimated_charges)} />
                <MiniCard label="Net Profit (T1)" value={formatCurrency(plan.net_profit_target1)}
                  color={plan.net_profit_target1 > 0 ? 'text-green-400' : 'text-red-400'} />
              </div>
            </div>

            {/* Charges Breakdown */}
            {plan.charges_breakdown && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-1">Charges Breakdown</h3>
                <p className="text-[9px] text-gray-600 mb-2">Buy + Sell combined (round-trip)</p>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <ChargeItem label="Brokerage" value={plan.charges_breakdown.brokerage} sublabel="Both sides" />
                  <ChargeItem label="STT" value={plan.charges_breakdown.stt} sublabel="Sell side" />
                  <ChargeItem label="Exchange" value={plan.charges_breakdown.exchange_txn} sublabel="Turnover" />
                  <ChargeItem label="GST" value={plan.charges_breakdown.gst} sublabel="18% on fees" />
                  <ChargeItem label="Stamp" value={plan.charges_breakdown.stamp_duty} sublabel="Buy side" />
                  <ChargeItem label="Total" value={plan.charges_breakdown.total} highlight />
                </div>
              </div>
            )}

            {/* Indicators */}
            {plan.indicators && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2">
                  <BarChart3 size={12} /> Indicators
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <Indicator label="RSI" value={plan.indicators.rsi}
                    color={plan.indicators.rsi > 70 ? 'text-red-400' : plan.indicators.rsi < 30 ? 'text-green-400' : 'text-white'} />
                  <Indicator label="VWAP" value={`₹${plan.indicators.vwap?.toFixed(0)}`} />
                  <Indicator label="ATR" value={`₹${plan.indicators.atr?.toFixed(1)}`} />
                  <Indicator label="EMA9" value={`₹${plan.indicators.ema9?.toFixed(0)}`} />
                  <Indicator label="EMA21" value={`₹${plan.indicators.ema21?.toFixed(0)}`} />
                  <Indicator label="Vol" value={`${plan.indicators.volume_ratio?.toFixed(1)}x`}
                    color={plan.indicators.volume_ratio > 1.5 ? 'text-green-400' : 'text-white'} />
                  <Indicator label="High" value={`₹${plan.indicators.day_high?.toFixed(0)}`} />
                  <Indicator label="Low" value={`₹${plan.indicators.day_low?.toFixed(0)}`} />
                  <Indicator label="MACD" value={plan.indicators.macd > 0 ? 'Bullish' : 'Bearish'}
                    color={plan.indicators.macd > 0 ? 'text-green-400' : 'text-red-400'} />
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function PlanRow({ label, value, color, sub }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className={`text-xs font-bold ${color}`}>{label}</span>
        {sub && <p className="text-[9px] text-gray-500">{sub}</p>}
      </div>
      <span className="text-sm font-mono font-bold text-white">{value}</span>
    </div>
  )
}

function MiniCard({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-dark-900 rounded-lg p-2 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-500">{label}</p>
    </div>
  )
}

function Indicator({ label, value, color = 'text-white' }) {
  return (
    <div className="text-center">
      <p className={`text-xs font-mono font-bold ${color}`}>{value}</p>
      <p className="text-[8px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}

function ChargeItem({ label, value, highlight, sublabel }) {
  return (
    <div className={`rounded-lg p-1.5 ${highlight ? 'bg-amber-500/10' : 'bg-dark-900'}`}>
      <p className={`text-[10px] font-mono font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>₹{value?.toFixed(2)}</p>
      <p className="text-[8px] text-gray-500">{label}</p>
      {sublabel && <p className="text-[7px] text-gray-600">{sublabel}</p>}
    </div>
  )
}
