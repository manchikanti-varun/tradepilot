import { AlertTriangle, ShieldAlert, Zap, Clock, Wifi, WifiOff, Activity } from 'lucide-react'
import IntakeBar from '../components/IntakeBar'
import GrowthCard from '../components/GrowthCard'
import PositionCard from '../components/PositionCard'
import SignalCard from '../components/SignalCard'
import BriefCard from '../components/BriefCard'
import MarketOverview from '../components/MarketOverview'
import MarketStatus from '../components/MarketStatus'
import { formatCurrency } from '../api'

export default function Dashboard({ state, growth, position, signals, brief, rejections, clock, handleIntake, handleCapitalUpdate }) {
  // Use live capital (growth) instead of cached brief
  const liveCapital = growth?.current_capital
  const briefFixed = brief ? {
    ...brief,
    capital_snapshot: { ...brief.capital_snapshot, current_capital: liveCapital || brief.capital_snapshot?.current_capital }
  } : null

  return (
    <div className="space-y-3 pb-4">
      {/* Header */}
      <div className="flex justify-between items-center pt-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            TradePilot <span className="text-accent-blue">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-400">{clock}</span>
          {state ? <Wifi size={10} className="text-green-400" /> : <WifiOff size={10} className="text-red-400" />}
        </div>
      </div>

      {/* Trade Intake */}
      <IntakeBar onSubmit={handleIntake} />

      {/* Market Status + Ticker */}
      <MarketStatus />

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-4 gap-2">
        <QuickStat label="Capital" value={liveCapital ? formatCurrency(liveCapital) : '—'} />
        <QuickStat label="VIX" value={brief?.vix?.toFixed(1) || '—'}
          color={(brief?.vix || 0) > 22 ? 'text-red-400' : (brief?.vix || 0) > 17 ? 'text-amber-400' : 'text-green-400'} />
        <QuickStat label="Risk" value={state?.risk_gate || 'GO'}
          color={state?.risk_gate === 'GO' ? 'text-green-400' : state?.risk_gate === 'CAUTION' ? 'text-amber-400' : 'text-red-400'} />
        <QuickStat label="Mode" value={state?.market_mode || '—'} />
      </div>

      {/* Risk Banners */}
      {state?.risk_gate === 'HARD_STOP' && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 px-3 py-2.5 rounded-xl">
          <ShieldAlert size={14} />
          <span className="text-xs font-medium">{state.risk_reason}</span>
        </div>
      )}
      {state?.risk_gate === 'CAUTION' && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-400 px-3 py-2.5 rounded-xl">
          <AlertTriangle size={14} />
          <span className="text-xs font-medium">{state.risk_reason}</span>
        </div>
      )}

      {/* Morning Brief (collapsible) */}
      {briefFixed && <BriefCard brief={briefFixed} />}

      {/* Active Position + Live P&L */}
      {position?.active && (
        <>
          <PositionCard data={position} />
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
            position.position.net_pnl >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
          }`}>
            <div className="flex items-center gap-1.5">
              <Activity size={12} className={position.position.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
              <span className="text-[10px] text-gray-400">If exit now:</span>
            </div>
            <span className={`text-sm font-extrabold font-mono ${position.position.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {position.position.net_pnl >= 0 ? '+' : ''}{formatCurrency(position.position.net_pnl)}
            </span>
          </div>
        </>
      )}

      {/* Signal Card */}
      <SignalCard signals={signals} />

      {/* Market Sectors + Movers */}
      <MarketOverview />

      {/* Growth (only if no position active) */}
      {!position?.active && growth && <GrowthCard growth={growth} onUpdate={handleCapitalUpdate} />}

      {/* Rejections */}
      {rejections?.total_rejected > 0 && (
        <div className="flex items-center gap-2 bg-dark-700 border border-dark-600 rounded-xl px-3 py-2">
          <Zap size={12} className="text-amber-400" />
          <span className="text-[10px] text-gray-400">{rejections.headline}</span>
        </div>
      )}
    </div>
  )
}

function QuickStat({ label, value, color = 'text-white' }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-lg p-2 text-center">
      <p className={`text-xs font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[8px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}
