import { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import SectionLabel from '../shared/SectionLabel';
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
  const hasDrawdown = peak_capital && peak_capital > current_capital;

  return (
    <div className="px-4 py-3">
      <SectionLabel className="mb-2 block">Capital</SectionLabel>
      <div className="bg-gradient-to-br from-info/8 to-transparent border border-info/20 rounded-xl p-4">
        {/* Amount + Tier */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-info/15 flex items-center justify-center">
              <Wallet size={15} className="text-info" />
            </div>
            <div>
              <span className="text-lg font-mono font-bold text-text-primary">
                ₹{Number(current_capital).toLocaleString('en-IN')}
              </span>
              {hasDrawdown && (
                <span className="text-[10px] text-sell flex items-center gap-0.5 mt-0.5">
                  <ArrowDownRight size={10} /> {drawdown_from_peak_pct?.toFixed(1)}% from peak
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-info bg-info/12 px-2 py-1 rounded-lg">
            TIER {current_tier}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-base rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-info to-cyan-400 rounded-full transition-all duration-700"
            style={{ width: `${progress_pct_to_next_tier}%` }}
          />
        </div>

        {/* Range labels */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] font-mono text-text-muted">₹{range[0].toLocaleString()}</span>
          <span className="text-[9px] text-text-muted font-medium">
            {progress_pct_to_next_tier.toFixed(0)}% → Tier {nextTier}
          </span>
          <span className="text-[9px] font-mono text-text-muted">₹{range[1].toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
