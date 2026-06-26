import { useState, useEffect } from 'react';
import { settingsApi } from '../../api/settings';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import { SkeletonCard } from '../shared/Skeleton';

export default function CapitalCard() {
  const [growth, setGrowth] = useState(null);

  useEffect(() => {
    settingsApi.growth().then(setGrowth).catch(() => {});
  }, []);

  if (!growth) return <SkeletonCard />;

  const { current_capital, current_tier, progress_pct_to_next_tier } = growth;

  return (
    <div className="px-4 py-3">
      <SectionLabel className="mb-2 block">Capital</SectionLabel>
      <div className="bg-surface border border-border-dim rounded-lg p-3">
        <div className="flex items-baseline justify-between mb-2">
          <MonoNumber
            value={`₹${Number(current_capital).toLocaleString('en-IN')}`}
            className="text-base font-semibold"
          />
          <span className="text-[10px] font-mono text-info uppercase">TIER {current_tier}</span>
        </div>
        <div className="h-1 bg-border-dim rounded-full overflow-hidden">
          <div
            className="h-full bg-info rounded-full transition-all duration-500"
            style={{ width: `${progress_pct_to_next_tier}%` }}
          />
        </div>
        <p className="text-[9px] text-text-muted mt-1 text-right">
          {progress_pct_to_next_tier.toFixed(0)}% to next tier
        </p>
      </div>
    </div>
  );
}
