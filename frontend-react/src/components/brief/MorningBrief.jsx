import { useState, useEffect } from 'react';
import { Sun } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { usePoll } from '../../hooks/usePoll';
import Card from '../shared/Card';
import SectionLabel from '../shared/SectionLabel';
import Badge from '../shared/Badge';
import { SkeletonCard } from '../shared/Skeleton';
import ErrorState from '../shared/ErrorState';

export default function MorningBrief() {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);

  const fetchBrief = async () => {
    try {
      const data = await settingsApi.brief();
      setBrief(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  usePoll(fetchBrief, 3600000); // Every hour

  if (error && !brief) return <ErrorState message="Failed to load brief" onRetry={fetchBrief} />;
  if (!brief) return <SkeletonCard />;

  const riskMode = brief.risk_state?.mode || 'GO';
  const riskVariant = riskMode === 'GO' ? 'buy' : riskMode === 'CAUTION' ? 'watch' : 'sell';

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sun size={13} className="text-watch" />
          <SectionLabel>Today's Brief</SectionLabel>
        </div>
        <Badge variant={riskVariant}>{riskMode}</Badge>
      </div>

      <p className="text-[13px] text-text-primary leading-relaxed mb-3">{brief.one_line_summary}</p>

      {brief.ai_summary && (
        <p className="text-[11px] text-text-secondary leading-relaxed mb-3">{brief.ai_summary}</p>
      )}

      {/* Top Picks */}
      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] text-text-muted uppercase">Top picks:</span>
          {brief.watchlist_summary.top_3_by_score.map((s) => (
            <span key={s.ticker} className="font-mono text-[10px] text-info bg-info/10 px-1.5 py-0.5 rounded">
              {s.ticker}
            </span>
          ))}
        </div>
      )}

      {/* Market Outlook */}
      {brief.market_outlook && (
        <div className="mt-3 pt-3 border-t border-border-dim">
          <p className="text-[11px] text-text-secondary">
            <span className="mr-1">{brief.market_outlook.weather}</span>
            {brief.market_outlook.advice}
          </p>
        </div>
      )}
    </Card>
  );
}
