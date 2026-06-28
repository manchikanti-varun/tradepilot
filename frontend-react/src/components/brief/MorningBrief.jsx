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
  const isHoliday = brief.is_market_holiday;

  // On holidays, override risk badge to show CLOSED
  let displayRiskMode = riskMode;
  let riskVariant = 'buy';
  if (isHoliday || riskMode === 'CLOSED') {
    displayRiskMode = 'CLOSED';
    riskVariant = 'neutral';
  } else if (riskMode === 'CAUTION') {
    riskVariant = 'watch';
  } else if (riskMode === 'HARD_STOP') {
    riskVariant = 'sell';
  }

  // Format date for display
  const briefDate = brief.date || brief.generated_at?.slice(0, 10) || null;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = briefDate === today;

  let dateLabel = 'Today\'s Brief';
  if (briefDate && !isToday) {
    // Show the actual date if it's not today
    const d = new Date(briefDate + 'T00:00:00');
    dateLabel = `Brief · ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  } else if (isHoliday) {
    dateLabel = `Holiday Brief · ${brief.holiday_reason || 'Market Closed'}`;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sun size={13} className="text-watch" />
          <SectionLabel>{dateLabel}</SectionLabel>
        </div>
        <Badge variant={riskVariant}>{displayRiskMode}</Badge>
      </div>

      {/* Holiday notice */}
      {isHoliday && (
        <div className="bg-overlay border border-border-dim rounded-md px-3 py-2 mb-3">
          <p className="text-[10px] text-text-muted">
            📅 {brief.holiday_reason || 'Market Holiday'} — No trading today
          </p>
        </div>
      )}

      {/* Stale brief warning */}
      {!isToday && !isHoliday && briefDate && (
        <div className="bg-watch/10 border border-watch/20 rounded-md px-3 py-1.5 mb-3">
          <p className="text-[10px] text-watch">
            ⚠ This brief is from {new Date(briefDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} — not today
          </p>
        </div>
      )}

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
