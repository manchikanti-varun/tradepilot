import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { historyApi } from '../../api/history';
import Card from '../shared/Card';
import SectionLabel from '../shared/SectionLabel';
import { SkeletonCard } from '../shared/Skeleton';
import ErrorState from '../shared/ErrorState';

export default function CoachPanel() {
  const [report, setReport] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      historyApi.coachReport().catch(() => null),
      historyApi.insights().catch(() => null),
    ]).then(([r, i]) => {
      setReport(r);
      setInsights(i);
    }).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorState message="Failed to load coach data" onRetry={() => window.location.reload()} />;
  if (!report && !insights) return <SkeletonCard />;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain size={14} className="text-conflicting" />
        <SectionLabel>AI Coach</SectionLabel>
      </div>

      {/* Coach Report */}
      {report && report.status !== 'disabled' && (
        <Card>
          <p className="text-xs text-text-primary font-medium mb-2">{report.headline}</p>
          {report.recommendations?.length > 0 && (
            <ul className="space-y-1.5">
              {report.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="text-[11px] text-text-secondary leading-relaxed flex gap-2">
                  <span className="text-text-muted shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Insights */}
      {insights?.insights?.length > 0 && (
        <div className="space-y-2">
          {insights.insights.slice(0, 4).map((insight, i) => {
            const borderColor = insight.type === 'warning' ? 'border-l-sell'
              : insight.type === 'streak' ? 'border-l-watch'
              : insight.type === 'tip' ? 'border-l-info'
              : 'border-l-buy';

            return (
              <div key={i} className={`bg-surface border border-border-dim border-l-[3px] ${borderColor} rounded-lg p-3`}>
                <p className="text-[11px] text-text-primary font-medium">{insight.title}</p>
                <p className="text-[10px] text-text-secondary mt-0.5">{insight.detail}</p>
              </div>
            );
          })}
        </div>
      )}

      {!report && (!insights || insights.insights?.length === 0) && (
        <p className="text-xs text-text-muted text-center py-6">Complete more trades to unlock AI coaching</p>
      )}
    </div>
  );
}
