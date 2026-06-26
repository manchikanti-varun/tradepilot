import { useState, useEffect, useRef } from 'react'
import { X, TrendingUp, TrendingDown, Minus, Target, Shield, Zap, BarChart3, Brain, CheckCircle2, XCircle, AlertTriangle, Activity } from 'lucide-react'
import { marketApi } from '../api/market'
import { formatCurrency } from '../api/client'

// Wrap marketApi.stockPlan to match old usage pattern
const api = { stockPlan: marketApi.stockPlan }

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
                  <div className="flex items-center gap-2 mb-3">
                    <VIcon size={18} className={v.color} />
                    <span className={`text-sm font-bold ${v.color}`}>{v.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                      plan.ai_analysis.confidence === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                      plan.ai_analysis.confidence === 'MEDIUM' ? 'bg-accent-blue/20 text-accent-blue' :
                      'bg-dark-600 text-gray-500'
                    }`}>{plan.ai_analysis.confidence} confidence</span>
                  </div>

                  {/* Llama Scout Opinion */}
                  <div className="bg-dark-900/50 rounded-lg p-2.5 mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-bold text-blue-400">LLAMA SCOUT</span>
                      {plan.ai_analysis.gemini_says
                        ? <span className="text-[9px] text-gray-500 ml-auto">responded</span>
                        : <span className="text-[9px] text-red-400 ml-auto">unavailable</span>
                      }
                    </div>
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      {plan.ai_analysis.gemini_says || "Llama Scout did not respond — using Groq only"}
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
                      {plan.ai_analysis.groq_says || "Groq did not respond — using Llama Scout only"}
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

            {/* Indicators (Technical Snapshot) */}
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

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TODAY'S PRICE ACTION — NEW SECTION                     */}
            {/* ═══════════════════════════════════════════════════════ */}
            <div className="border-t border-dark-600 my-4" />
            <TodaysPriceAction plan={plan} />
            <div className="border-t border-dark-600 my-4" />

            {/* Why This Stock (AI Reasoning) */}
            {plan.ai_analysis?.reasoning?.length > 0 && (
              <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-2">
                  <Brain size={12} className="text-purple-400" /> Why This Stock
                </h3>
                <div className="space-y-1.5">
                  {plan.ai_analysis.reasoning.map((reason, i) => (
                    <p key={i} className="text-[11px] text-gray-300 leading-relaxed">{reason}</p>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S PRICE ACTION SECTION
// ═══════════════════════════════════════════════════════════════

function TodaysPriceAction({ plan }) {
  const [ltpFlash, setLtpFlash] = useState('')
  const [highFlash, setHighFlash] = useState('')
  const [lowFlash, setLowFlash] = useState('')
  const prevLtp = useRef(null)
  const prevHigh = useRef(null)
  const prevLow = useRef(null)

  // Extract data from plan.indicators
  // API returns: ltp, open_price (nullable), day_high, day_low, vwap, support, resistance
  const currentLtp = plan?.ltp ?? plan?.indicators?.ltp ?? null
  const dayHigh = plan?.indicators?.day_high ?? null
  const dayLow = plan?.indicators?.day_low ?? null
  // open_price: session open (9:15 AM IST candle). null if market not open yet or data unavailable.
  const openPrice = plan?.indicators?.open_price ?? null
  const vwap = plan?.indicators?.vwap ?? null

  // Live update flash detection
  useEffect(() => {
    if (prevLtp.current !== null && currentLtp !== null && currentLtp !== prevLtp.current) {
      setLtpFlash(currentLtp > prevLtp.current ? 'text-green-400' : 'text-red-400')
      setTimeout(() => setLtpFlash(''), 300)
    }
    prevLtp.current = currentLtp
  }, [currentLtp])

  useEffect(() => {
    if (prevHigh.current !== null && dayHigh !== null && dayHigh > prevHigh.current) {
      setHighFlash('text-green-400')
      setTimeout(() => setHighFlash(''), 300)
    }
    prevHigh.current = dayHigh
  }, [dayHigh])

  useEffect(() => {
    if (prevLow.current !== null && dayLow !== null && dayLow < prevLow.current) {
      setLowFlash('text-red-400')
      setTimeout(() => setLowFlash(''), 300)
    }
    prevLow.current = dayLow
  }, [dayLow])

  // Determine market hours for edge cases
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const hour = nowIST.getHours()
  const minute = nowIST.getMinutes()
  const totalMin = hour * 60 + minute
  const isPreMarket = totalMin < 555 // before 9:15
  const isPostMarket = totalMin > 930 // after 15:30

  // Effective open price (use actual if available, else null)
  const effectiveOpen = openPrice && openPrice > 0 ? openPrice : null

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={13} className="text-accent-blue" />
        <span className="text-[11px] uppercase tracking-[0.1em] text-gray-500 font-semibold">
          Today's Price Action
        </span>
        {isPostMarket && (
          <span className="text-[9px] bg-dark-600 text-gray-400 px-1.5 py-0.5 rounded ml-auto">FINAL</span>
        )}
      </div>

      {/* PART 1 — MOVE FROM OPEN */}
      <MoveFromOpen
        openPrice={effectiveOpen}
        currentLtp={currentLtp}
        vwap={vwap}
        isPreMarket={isPreMarket}
        ltpFlash={ltpFlash}
      />

      {/* PART 2 — DAY'S RANGE */}
      <DaysRange
        dayHigh={dayHigh}
        dayLow={dayLow}
        currentLtp={currentLtp}
        ltpFlash={ltpFlash}
        highFlash={highFlash}
        lowFlash={lowFlash}
      />
    </div>
  )
}

function MoveFromOpen({ openPrice, currentLtp, vwap, isPreMarket, ltpFlash }) {
  // Pre-market: open not yet available
  if (isPreMarket) {
    return (
      <div className="mb-4">
        <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-2">From Open</span>
        <div className="bg-dark-900 rounded-lg p-3 text-center">
          <p className="text-[11px] text-gray-400">Market not yet open — showing previous close</p>
          {vwap && vwap > 0 && (
            <p className="text-xs text-gray-500 mt-1">Previous close (approx): <span className="font-mono text-gray-300">₹{vwap.toFixed(2)}</span></p>
          )}
          <p className="text-[10px] text-gray-600 mt-1">Today's open will appear at 9:15 AM IST</p>
        </div>
      </div>
    )
  }

  // Open price unavailable
  if (!openPrice || openPrice <= 0) {
    return (
      <div className="mb-4">
        <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-2">From Open</span>
        <div className="bg-dark-900 rounded-lg p-3 text-center">
          <p className="text-[11px] text-gray-400">Open price unavailable</p>
        </div>
      </div>
    )
  }

  if (currentLtp === null) {
    return (
      <div className="mb-4">
        <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-2">From Open</span>
        <div className="h-12 rounded bg-dark-900 animate-pulse" />
      </div>
    )
  }

  const changeAmount = currentLtp - openPrice
  const changePct = openPrice > 0 ? (changeAmount / openPrice) * 100 : 0
  const direction = Math.abs(changePct) < 0.1 ? 'flat' : changeAmount > 0 ? 'up' : 'down'

  const changeColor = direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-gray-400'
  const changeSign = changeAmount >= 0 ? '+' : '−'
  const absAmount = Math.abs(changeAmount)
  const absPct = Math.abs(changePct)

  // Bar calculations
  const MAX_PCT = 5.0
  const fillPct = Math.min(Math.abs(changePct) / MAX_PCT * 50, 50)

  const directionLabel = direction === 'up'
    ? '↑ Trading above open — bullish intraday momentum'
    : direction === 'down'
    ? '↓ Trading below open — bearish intraday pressure'
    : '→ Flat open — no clear intraday direction yet'

  return (
    <div className="mb-4">
      <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-2">From Open</span>

      {/* Open → Current row */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-center">
          <p className="font-mono text-[13px] text-gray-400">₹{openPrice.toFixed(2)}</p>
          <p className="text-[10px] text-gray-600">opened at</p>
        </div>
        <span className="text-gray-600 text-base">→</span>
        <div className="text-center">
          <p className={`font-mono text-[13px] text-white transition-colors duration-300 ${ltpFlash}`}>₹{currentLtp.toFixed(2)}</p>
          <p className="text-[10px] text-gray-600">now</p>
        </div>
      </div>

      {/* Change amount and percent */}
      <div className="text-center mb-2">
        <span className={`font-mono text-lg font-semibold ${changeColor}`}>
          {changeSign} ₹{absAmount.toFixed(2)}
        </span>
        <span className={`font-mono text-sm ml-2 ${changeColor}`}>
          ({changeSign}{absPct.toFixed(2)}%)
        </span>
      </div>

      {/* Direction label */}
      <p className="text-[12px] text-gray-400 italic text-center mb-3">{directionLabel}</p>

      {/* Visual bar — open = center */}
      <div className="relative h-1.5 bg-dark-900 rounded-full overflow-visible">
        {/* Center marker */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-0.5 w-0.5 h-2.5 bg-gray-600 rounded-sm z-10" />
        {/* Fill */}
        {direction === 'up' && (
          <div
            className="absolute top-0 left-1/2 h-full bg-green-400/60 rounded-r-full transition-all duration-300 ease-out"
            style={{ width: `${fillPct}%` }}
          />
        )}
        {direction === 'down' && (
          <div
            className="absolute top-0 h-full bg-red-400/60 rounded-l-full transition-all duration-300 ease-out"
            style={{ width: `${fillPct}%`, right: '50%' }}
          />
        )}
        {/* Overflow indicator */}
        {Math.abs(changePct) > MAX_PCT && (
          <span className={`absolute top-0 text-[9px] font-mono ${direction === 'up' ? 'right-0 text-green-400' : 'left-0 text-red-400'}`}>
            {direction === 'up' ? '›' : '‹'}
          </span>
        )}
      </div>
    </div>
  )
}

function DaysRange({ dayHigh, dayLow, currentLtp, ltpFlash, highFlash, lowFlash }) {
  // If data missing, show skeleton
  if (dayHigh === null || dayLow === null || currentLtp === null) {
    return (
      <div className="mt-4">
        <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-2">Day's Range</span>
        <div className="h-16 rounded bg-dark-900 animate-pulse" />
      </div>
    )
  }

  const range = dayHigh - dayLow
  const noRangeYet = range <= 0 || (dayHigh === dayLow)

  // Position calculation
  let positionPct = range > 0 ? ((currentLtp - dayLow) / range) * 100 : 50
  let dataWarning = null

  // Clamp and detect inconsistency
  if (currentLtp < dayLow) {
    positionPct = 0
    dataWarning = '⚠ Price data may be delayed'
  } else if (currentLtp > dayHigh) {
    positionPct = 100
    dataWarning = '⚠ Price data may be delayed'
  }
  positionPct = Math.max(0, Math.min(100, positionPct))

  // Marker position clamped for visual (2% to 98%)
  const markerPct = Math.max(2, Math.min(98, positionPct))

  // Distance from high and low
  const pctFromLow = dayLow > 0 ? ((currentLtp - dayLow) / dayLow) * 100 : 0
  const pctFromHigh = dayHigh > 0 ? ((dayHigh - currentLtp) / dayHigh) * 100 : 0

  // Position summary
  let posLabel = ''
  let posColor = 'text-gray-500'
  if (positionPct <= 20) {
    posLabel = 'Near day low — possible support or further weakness'
    posColor = 'text-red-400'
  } else if (positionPct <= 40) {
    posLabel = 'In lower range — below midpoint'
    posColor = 'text-amber-400'
  } else if (positionPct <= 60) {
    posLabel = 'Near midpoint of today\'s range'
    posColor = 'text-gray-400'
  } else if (positionPct <= 80) {
    posLabel = 'In upper range — above midpoint'
    posColor = 'text-amber-400'
  } else {
    posLabel = 'Near day high — momentum or resistance zone'
    posColor = 'text-green-400'
  }

  // Circuit detection
  const isUpperCircuit = positionPct >= 100 && !dataWarning
  const isLowerCircuit = positionPct <= 0 && !dataWarning

  return (
    <div className="mt-4">
      <span className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium block mb-3">Day's Range</span>

      {noRangeYet ? (
        <div className="text-center py-3">
          <p className="text-[11px] text-gray-500">No intraday trades yet — market just opened</p>
        </div>
      ) : (
        <>
          {/* Three values row: Low — Current — High */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-center">
              <p className={`font-mono text-sm transition-colors duration-300 ${lowFlash || 'text-red-400'}`}>
                ₹{dayLow.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-600">LOW</p>
            </div>
            <div className="text-center">
              <p className={`font-mono text-base font-semibold transition-colors duration-300 ${ltpFlash || 'text-white'}`}>
                ₹{currentLtp.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-600">NOW</p>
            </div>
            <div className="text-center">
              <p className={`font-mono text-sm transition-colors duration-300 ${highFlash || 'text-green-400'}`}>
                ₹{dayHigh.toFixed(2)}
              </p>
              <p className="text-[10px] text-gray-600">HIGH</p>
            </div>
          </div>

          {/* Range bar with gradient */}
          <div className="relative mb-1">
            <div
              className="h-2 rounded-full w-full"
              style={{ background: 'linear-gradient(to right, #DC2626, #18181C 45%, #18181C 55%, #16A34A)' }}
            />
            {/* Current price marker (diamond) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
              style={{ left: `${markerPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
            >
              <div className="w-2.5 h-2.5 bg-white rotate-45 rounded-sm shadow-sm" />
            </div>
          </div>

          {/* Percentage labels below bar */}
          <div className="flex justify-between text-[10px] text-gray-600 mb-2">
            <span>0%</span>
            <span>100%</span>
          </div>

          {/* Circuit badges */}
          {isUpperCircuit && (
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded">⚡ Upper circuit</span>
            </div>
          )}
          {isLowerCircuit && (
            <div className="flex items-center justify-center gap-1 mb-2">
              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded">⚡ Lower circuit</span>
            </div>
          )}

          {/* Position summary */}
          <p className={`text-[12px] text-center mb-2 ${posColor}`}>
            Currently at {positionPct.toFixed(1)}% of today's range
          </p>
          <p className={`text-[11px] text-center italic ${posColor}`}>{posLabel}</p>

          {/* Data warning */}
          {dataWarning && (
            <p className="text-[11px] text-amber-400 text-center mt-1">{dataWarning}</p>
          )}

          {/* Distance pills */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-green-400 bg-dark-900 border border-dark-600 rounded px-2 py-0.5">
              ▲ {pctFromLow.toFixed(2)}% from low
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400 bg-dark-900 border border-dark-600 rounded px-2 py-0.5">
              ▼ {pctFromHigh.toFixed(2)}% from high
            </span>
          </div>

          {/* Range not established fallback text */}
          {range > 0 && range < 0.01 && (
            <p className="text-[10px] text-gray-600 text-center mt-2">Range not yet established</p>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HELPER COMPONENTS (unchanged from original)
// ═══════════════════════════════════════════════════════════════

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
