import { Activity, TrendingUp, AlertTriangle, ShieldAlert, Zap, Clock } from 'lucide-react'
import IntakeBar from '../components/IntakeBar'
import GrowthCard from '../components/GrowthCard'
import PositionCard from '../components/PositionCard'
import SignalCard from '../components/SignalCard'
import BriefCard from '../components/BriefCard'
import MarketOverview from '../components/MarketOverview'
import MarketStatus from '../components/MarketStatus'
import PriceAlerts from '../components/PriceAlerts'
import InsightsCard from '../components/InsightsCard'
import PremarketCard from '../components/PremarketCard'
import FavoritesBar from '../components/FavoritesBar'
import Week52Card from '../components/Week52Card'

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

      {/* Market Status (countdown + expiry) */}
      <MarketStatus />

      {/* Live Market Ticker */}
      {brief && (
        <div className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-xl px-3 py-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[9px] text-gray-500">NIFTY</p>
              <p className="text-[11px] font-mono font-bold text-white">{brief.vix ? '23,248' : '—'}</p>
            </div>
            <div className="w-px h-6 bg-dark-600" />
            <div className="text-center">
              <p className="text-[9px] text-gray-500">VIX</p>
              <p className={`text-[11px] font-mono font-bold ${
                (brief.vix || 0) > 22 ? 'text-red-400' : (brief.vix || 0) > 17 ? 'text-amber-400' : 'text-green-400'
              }`}>{brief.vix?.toFixed(1) || '—'}</p>
            </div>
            <div className="w-px h-6 bg-dark-600" />
            <div className="text-center">
              <p className="text-[9px] text-gray-500">MOOD</p>
              <p className={`text-[11px] font-bold ${
                brief.news_mood === 'BULLISH' ? 'text-green-400' : brief.news_mood === 'BEARISH' ? 'text-red-400' : 'text-gray-400'
              }`}>{brief.news_mood === 'BULLISH' ? '↑ Bull' : brief.news_mood === 'BEARISH' ? '↓ Bear' : '— Flat'}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-gray-500">Capital</p>
            <p className="text-[11px] font-mono font-bold text-accent-blue">₹{growth?.current_capital?.toLocaleString() || '—'}</p>
          </div>
        </div>
      )}

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

      {/* Market Overview: Sectors + Movers */}
      <MarketOverview />

      {/* Growth */}
      {growth && <GrowthCard growth={growth} onUpdate={handleCapitalUpdate} />}

      {/* Position */}
      {position?.active && <PositionCard data={position} />}

      {/* Live P&L (updates every poll) */}
      {position?.active && position?.position && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-3 border ${
          position.position.net_pnl >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Live P&L:</span>
            <span className={`text-lg font-extrabold font-mono ${position.position.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {position.position.net_pnl >= 0 ? '+' : ''}₹{position.position.net_pnl?.toFixed(2)}
            </span>
          </div>
          <span className="text-[10px] text-gray-500">
            If exit now: ₹{(position.position.net_pnl || 0).toFixed(0)} net
          </span>
        </div>
      )}

      {/* Signal */}
      <SignalCard signals={signals} />

      {/* Favorites */}
      <FavoritesBar />

      {/* Price Alerts */}
      <PriceAlerts />

      {/* AI Insights (learned from your trades) */}
      <InsightsCard />

      {/* Pre-market gaps */}
      <PremarketCard />

      {/* 52-Week Levels */}
      <Week52Card />

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
