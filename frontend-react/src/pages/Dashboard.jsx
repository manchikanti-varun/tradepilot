import { Activity, TrendingUp, AlertTriangle, ShieldAlert, Zap, Clock } from 'lucide-react'
import IntakeBar from '../components/IntakeBar'
import GrowthCard from '../components/GrowthCard'
import PositionCard from '../components/PositionCard'
import SignalCard from '../components/SignalCard'
import BriefCard from '../components/BriefCard'

export default function Dashboard({ state, growth, position, signals, brief, rejections, clock, handleIntake, handleCapitalUpdate }) {
  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center py-3">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            TradePilot <span className="text-accent-blue">AI</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-medium">Manual execution co-pilot</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Clock size={12} className="text-gray-500" />
            <span className="text-xs font-mono text-gray-400">{clock}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            <span className="text-[10px] text-gray-500">{state?.market_mode || 'NORMAL'}</span>
          </div>
        </div>
      </div>

      {/* Intake */}
      <IntakeBar onSubmit={handleIntake} />

      {/* Banners */}
      {state?.risk_gate === 'HARD_STOP' && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl mb-3">
          <ShieldAlert size={16} />
          <span className="text-sm font-medium">{state.risk_reason}</span>
        </div>
      )}
      {state?.risk_gate === 'CAUTION' && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-400 px-4 py-3 rounded-xl mb-3">
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{state.risk_reason}</span>
        </div>
      )}

      {/* Brief */}
      {brief && <BriefCard brief={brief} />}

      {/* Growth */}
      {growth && <GrowthCard growth={growth} onUpdate={handleCapitalUpdate} />}

      {/* Position */}
      {position?.active && <PositionCard data={position} />}

      {/* Signal */}
      <SignalCard signals={signals} />

      {/* Rejections */}
      {rejections?.total_rejected > 0 && (
        <div className="flex items-center gap-2 bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 mt-3">
          <Zap size={14} className="text-amber-400" />
          <span className="text-xs text-gray-400">{rejections.headline}</span>
        </div>
      )}
    </>
  )
}
