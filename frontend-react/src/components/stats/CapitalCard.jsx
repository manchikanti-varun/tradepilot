import { useState, useEffect } from 'react';
import { Wallet, TrendingUp } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import { SkeletonCard } from '../shared/Skeleton';

const TIER_RANGES = { A: [1000, 2000], B: [2000, 5000], C: [5000, 10000], D: [10000, 100000] };

export default function CapitalCard() {
  const [growth, setGrowth] = useState(null);

  useEffect(() => {
    settingsApi.growth().then(setGrowth).catch(() => {});
  }, []);

  if (!growth) return <div className="px-4 py-3"><SkeletonCard /></div>;

  const { current_capital, current_tier, progress_pct_to_next_tier, peak_capital, drawdown_from_peak_pct } = growth;
  const range = TIER_RANGES[current_tier] || [1000, 2000];
  const nextTier = current_tier === 'D' ? 'MAX' : String.fromCharCode(current_tier.charCodeAt(0) + 1);

  return (
    <div className="px-4 py-3">
      <SectionLabel className="mb-2 block">Capital</SectionLabel>
      <div className="bg-gradient-to-br from-info/5 to-transparent border border-info/20 rounded-lg p-3">
        {/* Amount + Tier */}
        <div className="flex items-baseline justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet size={13} className="text-info" />
            <MonoNumber
              value={`₹${Number(current_capital).toLocaleString('en-IN')}`}
              className="text-lg font-semibold"
            />
          </div>
          <span className="text-[10px] font-mono font-medium text-info bg-info/10 px-1.5 py-0.5 rounded">
            TIER {current_tier}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-base rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-info to-cyan-400 rounded-full transition-all duration-700"
            style={{ width: `${progress_pct_to_next_tier}%` }}
          />
        </div>

        {/* Range labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[8px] font-mono text-text-muted">₹{range[0].toLocaleString()}</span>
          <span className="text-[9px] text-text-muted">
            {progress_pct_to_next_tier.toFixed(0)}% → Tier {nextTier}
          </span>
          <span className="text-[8px] font-mono text-text-muted">₹{range[1].toLocaleString()}</span>
        </div>

        {/* Peak + Drawdown */}
        {peak_capital && peak_capital > current_capital && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-dim">
            <span className="text-[9px] text-text-muted">Peak: ₹{Number(peak_capital).toLocaleString('en-IN')}</span>
            <span className="text-[9px] font-mono text-sell">
              ↓{drawdown_from_peak_pct?.toFixed(1) || '0'}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
