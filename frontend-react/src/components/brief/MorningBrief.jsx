import { useState } from 'react';
import { Sun, AlertTriangle, Calendar, Sparkles } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { usePoll } from '../../hooks/usePoll';
import Card from '../shared/Card';
import SectionLabel from '../shared/SectionLabel';
import Badge from '../shared/Badge';
import Spinner from '../shared/Spinner';
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

  usePoll(fetchBrief, 3600000);

  if (error && !brief) return <ErrorState message="Failed to load brief" onRetry={fetchBrief} />;
  if (!brief) return <div className="py-8 flex justify-center"><Spinner size={20} /></div>;

  const riskMode = brief.risk_state?.mode || 'GO';
  const isHoliday = brief.is_market_holiday;

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

  const briefDate = brief.date || brief.generated_at?.slice(0, 10) || null;
  const today = new Date().toISOString().slice(0, 10);
  const isToday = briefDate === today;

  let dateLabel = "Today's Brief";
  if (briefDate && !isToday) {
    const d = new Date(briefDate + 'T00:00:00');
    dateLabel = `Brief · ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  } else if (isHoliday) {
    dateLabel = 'Holiday Brief';
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-watch/12 flex items-center justify-center">
            <Sun size={14} className="text-watch" />
          </div>
          <SectionLabel>{dateLabel}</SectionLabel>
        </div>
        <Badge variant={riskVariant}>{displayRiskMode}</Badge>
      </div>

      {isHoliday && (
        <div className="bg-overlay border border-border-dim rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <Calendar size={12} className="text-text-muted" />
          <p className="text-[11px] text-text-muted">
            {brief.holiday_reason || 'Market Holiday'} — No trading today
          </p>
        </div>
      )}

      {!isToday && !isHoliday && briefDate && (
        <div className="bg-watch/8 border border-watch/20 rounded-xl px-4 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle size={12} className="text-watch" />
          <p className="text-[10px] text-watch font-medium">
            This brief is from {new Date(briefDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      )}

      <p className="text-[13px] text-text-primary leading-relaxed mb-3 font-medium">{brief.one_line_summary}</p>

      {brief.ai_summary && (
        <p className="text-[11px] text-text-secondary leading-relaxed mb-3">{brief.ai_summary}</p>
      )}

      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border-dim">
          <span className="text-[9px] text-text-muted uppercase font-semibold">Top picks:</span>
          {brief.watchlist_summary.top_3_by_score.map((s) => (
            <span key={s.ticker} className="font-mono text-[10px] text-info bg-info/10 px-2 py-0.5 rounded-md font-semibold">
              {s.ticker}
            </span>
          ))}
        </div>
      )}

      {brief.market_outlook && (
        <div className="mt-3 pt-3 border-t border-border-dim flex items-start gap-2">
          <Sparkles size={12} className="text-text-muted mt-0.5 shrink-0" />
          <p className="text-[11px] text-text-secondary leading-relaxed">
            {brief.market_outlook.weather} {brief.market_outlook.advice}
          </p>
        </div>
      )}
    </Card>
  );
}
