import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Target, Shield, AlertTriangle, Zap, BarChart3, Lightbulb, Clock, Newspaper, History, DollarSign, Layers, CheckCircle2, XCircle } from 'lucide-react'
import { api, formatCurrency } from '../api'

const TREND_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Bullish' },
  BEARISH: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Bearish' },
  SIDEWAYS: { icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Sideways' },
}

export default function StockDetailModal({ symbol, onClose }) {
  const [plan, setPlan] = useState(null)
  const [multiframe, setMultiframe] = useState(null)
  const [chartData, setChartData] = useState(null)
  const [chartInterval, setChartInterval] = useState('5m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.stockPlan(symbol),
      api.stockMultiframe(symbol).catch(() => null),
      api.chart(symbol, '5m').catch(() => null),
    ]).then(([p, mf, ch]) => {
      setPlan(p)
      setMultiframe(mf)
      setChartData(ch)
    }).catch(e => setError('Could not load data for this stock'))
      .finally(() => setLoading(false))
  }, [symbol])

  const changeInterval = (interval) => {
    setChartInterval(interval)
    api.chart(symbol, interval).then(setChartData).catch(() => {})
  }

  if (!symbol) return null

  const trend = plan ? TREND_CONFIG[plan.trend] || TREND_CONFIG.SIDEWAYS : null
  const TrendIcon = trend?.icon || Minus

  return (
    <div className="fixed inset-0 bg-black/70 z-[1001] flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-dark-800 border-t border-dark-600 rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold">{symbol}</h2>
            {plan && <p className="text-xs text-gray-500">{plan.sector} • ₹{plan.ltp?.toFixed(2)}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-dark-700">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-5 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {plan && !loading && (
          <div className="p-5 space-y-4">

            {/* Price Chart */}
            {chartData?.candles?.length > 0 && (
              <div className="bg-dark-900 rounded-xl p-3">
                <div className="flex items-center gap-1 mb-2">
                  {['5m', '15m', '1h', '1d'].map(tf => (
                    <button key={tf} onClick={() => changeInterval(tf)}
                      className={`px-2 py-1 rounded text-[9px] font-bold ${
                        chartInterval === tf ? 'bg-accent-blue text-white' : 'bg-dark-700 text-gray-500'
                      }`}>{tf === '1d' ? 'Day' : tf}</button>
                  ))}
                </div>
                <div className="h-32 flex items-end gap-px">
                  {(() => {
                    const candles = chartData.candles.slice(-60)
                    const highs = candles.map(c => c.high)
                    const lows = candles.map(c => c.low)
                    const maxP = Math.max(...highs)
                    const minP = Math.min(...lows)
                    const range = maxP - minP || 1
                    return candles.map((c, i) => {
                      const bullish = c.close >= c.open
                      const bodyTop = Math.max(c.open, c.close)
                      const bodyBot = Math.min(c.open, c.close)
                      const bodyH = Math.max(((bodyTop - bodyBot) / range) * 100, 2)
                      const bodyOffset = ((bodyBot - minP) / range) * 100
                      return (
                        <div key={i} className="flex-1 relative h-full flex items-end">
                          <div className={`w-full rounded-sm ${bullish ? 'bg-green-400' : 'bg-red-400'}`}
                            style={{ height: `${bodyH}%`, marginBottom: `${bodyOffset}%` }} />
                        </div>
                      )
                    })
                  })()}
                </div>
                <div className="flex justify-between mt-1 text-[8px] text-gray-600">
                  <span>{chartData.candles[chartData.candles.length - 60]?.time?.slice(11, 16) || ''}</span>
                  <span>{chartData.count} candles</span>
                  <span>{chartData.candles[chartData.candles.length - 1]?.time?.slice(11, 16) || ''}</span>
                </div>
              </div>
            )}
            <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-xl p-3.5">
              <p className="text-xs font-bold text-accent-blue mb-1 flex items-center gap-1.5">
                <Lightbulb size={12} /> Why this stock?
              </p>
              <p className="text-xs text-gray-200 leading-relaxed">{plan.why_this_stock}</p>
            </div>

            {/* Confidence + Sector Rank */}
            <div className="flex gap-2">
              <div className={`flex-1 rounded-xl p-3 text-center border ${
                plan.confidence === 'HIGH' ? 'bg-green-500/10 border-green-500/20' :
                plan.confidence === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/20' :
                'bg-red-500/10 border-red-500/20'
              }`}>
                <p className={`text-sm font-bold ${
                  plan.confidence === 'HIGH' ? 'text-green-400' :
                  plan.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'
                }`}>{plan.confidence}</p>
                <p className="text-[9px] text-gray-500">Confidence</p>
              </div>
              <div className="flex-1 bg-dark-700 border border-dark-600 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-white">{plan.sector_rank?.label}</p>
                <p className="text-[9px] text-gray-500">Sector Rank</p>
              </div>
            </div>

            {/* Trend Banner */}
            <div className={`${trend.bg} border border-current/20 rounded-xl p-3.5 ${trend.color}`}>
              <div className="flex items-center gap-2 mb-1">
                <TrendIcon size={16} />
                <span className="text-sm font-bold">{trend.label} Trend</span>
              </div>
              <p className="text-xs opacity-80">{plan.trend_description}</p>
            </div>

            {/* Multi-Timeframe Analysis */}
            {multiframe && multiframe.timeframes && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><Layers size={12} className="text-accent-blue" /> Multi-Timeframe</h3>
                <div className="flex gap-2">
                  {Object.entries(multiframe.timeframes).map(([tf, data]) => (
                    <div key={tf} className={`flex-1 rounded-lg p-2 text-center border ${
                      data.trend === 'BULLISH' ? 'bg-green-500/10 border-green-500/20' :
                      data.trend === 'BEARISH' ? 'bg-red-500/10 border-red-500/20' :
                      'bg-dark-900 border-dark-600'
                    }`}>
                      <p className="text-[9px] text-gray-500 uppercase">{tf}</p>
                      <p className={`text-[10px] font-bold ${
                        data.trend === 'BULLISH' ? 'text-green-400' :
                        data.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-400'
                      }`}>{data.trend === 'BULLISH' ? '↑' : data.trend === 'BEARISH' ? '↓' : '—'}</p>
                    </div>
                  ))}
                </div>
                <p className={`text-[10px] text-center mt-2 font-bold ${
                  multiframe.alignment === 'STRONG_BUY' ? 'text-green-400' :
                  multiframe.alignment === 'STRONG_SELL' ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {multiframe.alignment === 'STRONG_BUY' ? 'All timeframes bullish — STRONG BUY signal' :
                   multiframe.alignment === 'STRONG_SELL' ? 'All timeframes bearish — AVOID this stock' :
                   'Mixed signals across timeframes — be cautious'}
                </p>
              </div>
            )}

            {/* Entry / SL / Target */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Target size={13} className="text-accent-blue" /> Trading Plan
              </h3>

              <div className="space-y-3">
                <PlanRow label="Entry Zone" color="text-accent-blue"
                  value={`₹${plan.entry_zone.low} – ₹${plan.entry_zone.high}`}
                  sublabel="Buy only if price enters this range with volume" />
                <PlanRow label="Stop Loss" color="text-red-400"
                  value={`₹${plan.stop_loss}`}
                  sublabel={`Risk: ₹${plan.risk_per_share}/share • Exit immediately if hit`} />
                {plan.targets.map(t => (
                  <PlanRow key={t.level} label={t.label} color="text-green-400"
                    value={`₹${t.price}`} />
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-dark-600">
                  <span className="text-xs text-gray-400">Risk : Reward</span>
                  <span className={`text-sm font-bold ${plan.risk_reward >= 1.5 ? 'text-green-400' : plan.risk_reward >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                    1 : {plan.risk_reward}
                  </span>
                </div>
              </div>
            </div>

            {/* Qty & Capital */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <Zap size={13} className="text-amber-400" /> Position Size
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="Qty" value={plan.suggested_qty} />
                <MiniCard label="Capital Needed" value={formatCurrency(plan.capital_required)} />
                <MiniCard label="Charges" value={formatCurrency(plan.estimated_charges)} />
                <MiniCard label="Net Profit (T1)" value={formatCurrency(plan.net_profit_target1)}
                  color={plan.net_profit_target1 > 0 ? 'text-green-400' : 'text-red-400'} />
              </div>
            </div>

            {/* Charges Breakdown */}
            {plan.charges_breakdown && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><DollarSign size={12} className="text-amber-400" /> Charges Breakdown</h3>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <ChargeItem label="Brokerage" value={plan.charges_breakdown.brokerage} />
                  <ChargeItem label="STT" value={plan.charges_breakdown.stt} />
                  <ChargeItem label="Exchange" value={plan.charges_breakdown.exchange_txn} />
                  <ChargeItem label="GST" value={plan.charges_breakdown.gst} />
                  <ChargeItem label="Stamp" value={plan.charges_breakdown.stamp_duty} />
                  <ChargeItem label="Total" value={plan.charges_breakdown.total} highlight />
                </div>
              </div>
            )}

            {/* Last 5 Days */}
            {plan.last_5_days?.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><BarChart3 size={12} className="text-gray-400" /> Last 5 Days</h3>
                <div className="flex gap-1.5">
                  {plan.last_5_days.map((d, i) => (
                    <div key={i} className={`flex-1 rounded-lg p-1.5 text-center ${
                      d.change_pct >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                      <p className={`text-[10px] font-bold ${d.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {d.change_pct >= 0 ? '+' : ''}{d.change_pct}%
                      </p>
                      <p className="text-[8px] text-gray-500">{d.date?.slice(5)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stock News */}
            {plan.stock_news?.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><Newspaper size={12} className="text-gray-400" /> Recent News</h3>
                <div className="space-y-1.5">
                  {plan.stock_news.map((n, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-[10px] mt-0.5 ${n.sentiment === 'BULLISH' ? 'text-green-400' : n.sentiment === 'BEARISH' ? 'text-red-400' : 'text-gray-500'}`}>●</span>
                      <p className="text-[11px] text-gray-300">{n.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best Entry Time */}
            {plan.best_entry_time && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-3 flex items-center gap-3">
                <Clock size={16} className="text-accent-blue" />
                <div>
                  <p className="text-xs font-bold text-white">Best entry window: {plan.best_entry_time}</p>
                  <p className="text-[10px] text-gray-500">Based on recent intraday price pattern</p>
                </div>
              </div>
            )}

            {/* Past Signals */}
            {plan.past_signals?.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2"><History size={12} className="text-gray-400" /> Past Signals for {symbol}</h3>
                <div className="space-y-1.5">
                  {plan.past_signals.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-dark-900 rounded-lg px-3 py-2">
                      <span className="text-[11px] text-gray-400">{s.date}</span>
                      <span className="text-[11px] text-white">₹{s.ltp?.toFixed(0)} → ₹{s.target?.toFixed(0)}</span>
                      <span className={`text-[10px] font-bold ${s.outcome === 'WIN' ? 'text-green-400' : s.outcome === 'LOSS' ? 'text-red-400' : 'text-gray-500'}`}>
                        {s.outcome || 'PENDING'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Entry Conditions */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-green-400 mb-2 flex items-center gap-2"><CheckCircle2 size={12} /> When to Buy</h3>
              <ul className="space-y-1.5">
                {plan.entry_conditions.map((c, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Avoid Conditions */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-2"><XCircle size={12} /> When NOT to Buy</h3>
              <ul className="space-y-1.5">
                {plan.avoid_conditions.map((c, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">•</span>{c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk Advice */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-2">
                <Shield size={12} /> Risk Advice
              </h3>
              <ul className="space-y-1.5">
                {plan.risk_advice.map((a, i) => (
                  <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>

            {/* Indicators */}
            <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
              <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2">
                <BarChart3 size={12} /> Technical Indicators
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
                <Indicator label="Day High" value={`₹${plan.indicators.day_high?.toFixed(0)}`} />
                <Indicator label="Day Low" value={`₹${plan.indicators.day_low?.toFixed(0)}`} />
                <Indicator label="MACD" value={plan.indicators.macd_histogram > 0 ? '↑ Bull' : '↓ Bear'}
                  color={plan.indicators.macd_histogram > 0 ? 'text-green-400' : 'text-red-400'} />
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

function PlanRow({ label, value, sublabel, color }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <span className={`text-xs font-bold ${color}`}>{label}</span>
        {sublabel && <p className="text-[10px] text-gray-500 mt-0.5">{sublabel}</p>}
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

function ChargeItem({ label, value, highlight }) {
  return (
    <div className={`rounded-lg p-1.5 ${highlight ? 'bg-amber-500/10' : 'bg-dark-900'}`}>
      <p className={`text-[10px] font-mono font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>₹{value?.toFixed(2)}</p>
      <p className="text-[8px] text-gray-500">{label}</p>
    </div>
  )
}
