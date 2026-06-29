import { useState } from 'react';
import { Eye, SkipForward, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import Card from '../shared/Card';
import SignalBadge from './SignalBadge';
import PriceDisplay from './PriceDisplay';
import ExpiryTimer from './ExpiryTimer';
import MonoNumber from '../shared/MonoNumber';
import { useAppStore } from '../../store/useAppStore';

export default function SignalCard({ signal, onViewPlan, onSkip }) {
  const [expanded, setExpanded] = useState(false);

  if (!signal) return null;

  const {
    symbol, sector, grade, composite, ltp, stop_price, target,
    net_after_charges, breakeven_pct, risk_reward, message,
    expires_in_sec, qty, is_expired,
  } = signal;

  const confidence = composite >= 75 ? 'HIGH' : composite >= 60 ? 'MEDIUM' : 'LOW';
  const entryPct = stop_price && ltp ? -((ltp - stop_price) / ltp * 100) : 0;
  const targetPct = target && ltp ? ((target - ltp) / ltp * 100) : 0;
  const scoreBarWidth = Math.min(100, Math.max(0, composite));
  const scoreBarColor = composite >= 75 ? 'bg-buy' : composite >= 60 ? 'bg-watch' : 'bg-sell';

  const opacity = is_expired ? 'opacity-40 pointer-events-none' : '';

  return (
    <div className={`relative animate-slide-in ${opacity}`}>
      {is_expired && (
        <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl bg-base/60">
          <span className="text-xs font-mono font-bold text-sell bg-base/90 px-3 py-1.5 rounded-lg border border-sell/30">EXPIRED</span>
        </div>
      )}

      <Card accent={confidence.toLowerCase()}>
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SignalBadge confidence={confidence} />
            <span className="text-[10px] text-text-muted font-medium uppercase">{grade}-grade</span>
          </div>
          <ExpiryTimer expiresInSec={expires_in_sec} />
        </div>

        {/* Symbol + Score */}
        <div
          className="flex items-center justify-between mb-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-text-primary">{symbol}</span>
              <span className="text-[10px] font-semibold text-buy bg-buy/10 px-1.5 py-0.5 rounded">BUY</span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">{sector}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text-muted">Score</span>
              <MonoNumber value={composite} className="text-base font-bold" />
            </div>
            {/* Score bar */}
            <div className="w-16 h-1.5 bg-border-dim rounded-full overflow-hidden mt-1">
              <div className={`h-full ${scoreBarColor} rounded-full transition-all duration-500`} style={{ width: `${scoreBarWidth}%` }} />
            </div>
          </div>
        </div>

        {/* Price Levels */}
        <div className="bg-overlay rounded-lg p-3 space-y-2 mt-3">
          <PriceDisplay label="Entry" price={ltp} />
          <PriceDisplay label="Stop" price={stop_price} pct={entryPct} color="sell" />
          <PriceDisplay label="Target" price={target} pct={targetPct} color="buy" />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-overlay rounded-lg p-2 text-center">
            <span className="text-[9px] text-text-muted block">R:R</span>
            <MonoNumber value={`1:${risk_reward}`} className="text-xs font-semibold" />
          </div>
          <div className="bg-overlay rounded-lg p-2 text-center">
            <span className="text-[9px] text-text-muted block">Qty</span>
            <span className="text-xs font-mono font-semibold text-text-primary">{qty}</span>
          </div>
          <div className="bg-overlay rounded-lg p-2 text-center">
            <span className="text-[9px] text-text-muted block">Net Profit</span>
            <MonoNumber value={`₹${net_after_charges?.toFixed(0)}`} color="buy" className="text-xs font-semibold" />
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && message && (
          <div className="mt-3 pt-3 border-t border-border-dim animate-slide-in">
            <p className="text-[11px] text-text-secondary leading-relaxed">{message}</p>
            <p className="text-[10px] text-text-muted mt-1">Breakeven move: {breakeven_pct}%</p>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center mt-2 py-1 text-text-muted hover:text-text-secondary"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewPlan?.(symbol); }}
            disabled={is_expired}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-info/10 border border-info/30 text-xs font-semibold text-info hover:bg-info/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Eye size={13} />
            VIEW PLAN
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSkip?.(signal); }}
            disabled={is_expired}
            className="px-4 py-2.5 rounded-lg border border-border-dim text-xs text-text-muted hover:text-text-secondary hover:border-border-mid transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward size={13} />
          </button>
        </div>
      </Card>
    </div>
  );
}
