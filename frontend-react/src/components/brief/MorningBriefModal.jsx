import { useState, useEffect } from 'react';
import { Sun, ArrowRight } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { useMarketHours } from '../../hooks/useMarketHours';
import Badge from '../shared/Badge';
import MonoNumber from '../shared/MonoNumber';
import Spinner from '../shared/Spinner';

export default function MorningBriefModal() {
  const { shouldShowBrief, dismissBrief } = useMarketHours();
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shouldShowBrief) return;
    settingsApi.brief()
      .then(setBrief)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shouldShowBrief]);

  if (!shouldShowBrief) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-elevated border border-border-mid rounded-2xl p-6 w-full max-w-[560px] max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-in">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={24} />
          </div>
        ) : brief ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-watch/12 flex items-center justify-center">
                  <Sun size={18} className="text-watch" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Morning Brief</h2>
                  <span className="text-[10px] text-text-muted font-mono">{brief.date}</span>
                </div>
              </div>
              <Badge variant={brief.risk_state?.mode === 'GO' ? 'buy' : 'watch'}>
                {brief.risk_state?.mode || 'NORMAL'}
              </Badge>
            </div>

            <p className="text-[14px] text-text-primary leading-relaxed font-medium mb-4">{brief.one_line_summary}</p>

            {/* Key Numbers */}
            {brief.vix !== undefined && (
              <div className="grid grid-cols-3 gap-3 mb-5 p-4 bg-overlay rounded-xl">
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">VIX</p>
                  <MonoNumber value={brief.vix?.toFixed(1) || '—'} className="text-base font-bold" />
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">Mood</p>
                  <span className={`text-sm font-semibold ${
                    brief.news_mood === 'BULLISH' ? 'text-buy' : brief.news_mood === 'BEARISH' ? 'text-sell' : 'text-text-secondary'
                  }`}>{brief.news_mood || 'NEUTRAL'}</span>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase font-semibold">Candidates</p>
                  <MonoNumber value={brief.watchlist_summary?.total_candidates || 0} className="text-base font-bold" />
                </div>
              </div>
            )}

            {/* Top Picks */}
            {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2.5">Today's Focus</p>
                <div className="flex gap-2">
                  {brief.watchlist_summary.top_3_by_score.map((s) => (
                    <div key={s.ticker} className="flex-1 bg-surface border border-border-dim rounded-xl p-3 text-center">
                      <span className="font-mono text-sm font-bold text-text-primary">{s.ticker}</span>
                      {s.composite && <p className="text-[9px] text-text-muted mt-0.5">Score: {s.composite}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            {brief.ai_summary && (
              <div className="mb-5 p-4 bg-surface border border-border-dim rounded-xl">
                <p className="text-[12px] text-text-secondary leading-relaxed">{brief.ai_summary}</p>
              </div>
            )}

            <button
              onClick={dismissBrief}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-buy to-info text-white text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              START TRADING <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-text-secondary">Brief not available yet</p>
            <button onClick={dismissBrief} className="mt-4 text-xs text-info hover:underline">Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
