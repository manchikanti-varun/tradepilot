import { useState, useEffect } from 'react';
import { marketApi } from '../../api/market';
import { usePoll } from '../../hooks/usePoll';
import SectionLabel from '../shared/SectionLabel';
import { SkeletonCard } from '../shared/Skeleton';
import ErrorState from '../shared/ErrorState';

export default function MarketSectors() {
  const [sectors, setSectors] = useState(null);
  const [error, setError] = useState(null);

  const fetchSectors = async () => {
    try {
      const data = await marketApi.sectors();
      setSectors(data.sectors || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  usePoll(fetchSectors, 60000);

  if (error && !sectors) return <ErrorState message="Failed to load sectors" onRetry={fetchSectors} />;
  if (!sectors) return <SkeletonCard />;

  return (
    <div className="px-4 py-3">
      <SectionLabel className="mb-2 block">Sectors</SectionLabel>
      <div className="grid grid-cols-3 gap-1">
        {sectors.slice(0, 9).map((s) => {
          const bg = s.mood === 'POSITIVE' ? 'bg-buy/10 border-buy/20'
            : s.mood === 'NEGATIVE' ? 'bg-sell/10 border-sell/20'
            : 'bg-overlay border-border-dim';
          const textColor = s.mood === 'POSITIVE' ? 'text-buy'
            : s.mood === 'NEGATIVE' ? 'text-sell'
            : 'text-text-muted';

          return (
            <div key={s.sector} className={`border rounded px-1.5 py-1 text-center ${bg}`}>
              <p className="text-[8px] font-medium truncate text-text-secondary">{s.sector}</p>
              <p className={`text-[10px] font-mono font-medium ${textColor}`}>
                {s.avg_score.toFixed(0)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
