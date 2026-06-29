import { useState, useEffect } from 'react';
import { Brain, Lightbulb, AlertTriangle, Flame, Target } from 'lucide-react';
import { historyApi } from '../../api/history';
import Card from '../shared/Card';
import SectionLabel from '../shared/SectionLabel';
import Spinner from '../shared/Spinner';
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
  if (!report && !insights) return <div className="py-8 flex justify-center"><Spinner size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-conflicting/12 flex items-center justify-center">
          <Brain size={16} className="text-conflicting" />
        </div>
        <SectionLabel>AI Coach</SectionLabel>
      </div>

      {/* Coach Report */}
      {report && report.status !== 'disabled' && (
        <Card>
          <p className="text-sm text-text-primary font-semibold mb-3">{report.headline}</p>
          {report.recommendations?.length > 0 && (
            <ul className="space-y-2">
              {report.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="text-[11px] text-text-secondary leading-relaxed flex gap-2.5">
                  <Lightbulb size={12} className="text-watch shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
          {report.mindset_tip && (
            <div className="mt-3 pt-3 border-t border-border-dim">
              <p className="text-[11px] text-text-muted italic">{report.mindset_tip}</p>
            </div>
          )}
        </Card>
      )}

      {/* Insights */}
      {insights?.insights?.length > 0 && (
        <div className="space-y-2">
          {insights.insights.slice(0, 4).map((insight, i) => {
            const config = {
              warning: { border: 'border-l-sell', icon: AlertTriangle, iconColor: 'text-sell' },
              streak: { border: 'border-l-watch', icon: Flame, iconColor: 'text-watch' },
              tip: { border: 'border-l-info', icon: Lightbulb, iconColor: 'text-info' },
              achievement: { border: 'border-l-buy', icon: Target, iconColor: 'text-buy' },
            };
            const c = config[insight.type] || config.tip;
            const Icon = c.icon;

            return (
              <div key={i} className={`bg-surface border border-border-dim border-l-[3px] ${c.border} rounded-xl p-3.5`}>
                <div className="flex items-start gap-2.5">
                  <Icon size={13} className={`${c.iconColor} shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-[11px] text-text-primary font-semibold">{insight.title}</p>
                    <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">{insight.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!report && (!insights || insights.insights?.length === 0) && (
        <div className="text-center py-8">
          <Brain size={24} className="text-text-muted mx-auto mb-2" />
          <p className="text-xs text-text-muted">Complete more trades to unlock AI coaching</p>
        </div>
      )}
    </div>
  );
}
