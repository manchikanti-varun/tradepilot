import { useState } from 'react';
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

  const opacity = is_expired ? 'opacity-40' : '';

  return (
    <div className={`relative animate-slide-in ${opacity}`}>
      {is_expired && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-sm font-mono font-medium text-sell bg-base/80 px-3 py-1 rounded">EXPIRED</span>
        </div>
      )}

      <Card accent={confidence.toLowerCase()} className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <SignalBadge confidence={confidence} />
          <ExpiryTimer expiresInSec={expires_in_sec} />
        </div>

        {/* Ticker + Score */}
        <div className="flex items-center justify-between mb-1" onClick={() => setExpanded(!expanded)}>
          <div>
            <span className="font-mono text-2xl font-semibold text-text-primary">{symbol}</span>
            <span className="text-xs text-text-muted ml-2">BUY</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-text-muted">Score</span>
            <MonoNumber value={composite} className="text-sm font-medium ml-1" />
          </div>
        </div>

        {/* Meta */}
        <p className="text-[11px] text-text-secondary mb-3">
          {sector} · {grade}-grade
        </p>

        <div className="border-t border-border-dim pt-3 space-y-1.5">
          {/* Price Levels */}
          <PriceDisplay label="Entry" price={ltp} />
          <PriceDisplay label="Stop" price={stop_price} pct={entryPct} color="sell" />
          <PriceDisplay label="Target" price={target} pct={targetPct} color="buy" />

          {/* R:R */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-text-secondary">R:R</span>
            <MonoNumber value={`1 : ${risk_reward}`} className="text-xs font-medium" />
          </div>

          {/* Net Profit */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Net profit (est.)</span>
            <MonoNumber value={`₹${net_after_charges?.toFixed(2)}`} color="buy" className="text-xs font-medium" />
          </div>

          {/* Score Bar */}
          <div className="mt-2">
            <div className="h-1 w-full bg-border-dim rounded-full overflow-hidden">
              <div className={`h-full ${scoreBarColor} rounded-full transition-all duration-300`} style={{ width: `${scoreBarWidth}%` }} />
            </div>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && message && (
          <div className="mt-3 pt-3 border-t border-border-dim">
            <p className="text-[11px] text-text-secondary leading-relaxed">{message}</p>
            <p className="text-[10px] text-text-muted mt-1">Qty: {qty} shares · Breakeven: {breakeven_pct}%</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onViewPlan?.(symbol); }}
            disabled={is_expired}
            className="flex-1 py-2 rounded bg-overlay border border-border-mid text-xs font-medium text-text-primary hover:border-border-hi transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            VIEW FULL PLAN
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSkip?.(signal); }}
            disabled={is_expired}
            className="px-4 py-2 rounded border border-border-dim text-xs text-text-muted hover:text-text-secondary hover:border-border-mid transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            SKIP
          </button>
        </div>
      </Card>
    </div>
  );
}
