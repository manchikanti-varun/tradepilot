import { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
      <div className="bg-elevated border border-border-dim rounded-xl p-6 w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : brief ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-text-primary">Morning Brief</h2>
              <span className="text-xs text-text-muted font-mono">{brief.date}</span>
            </div>

            {/* Market Regime */}
            <div className="mb-4">
              <Badge variant={brief.risk_state?.mode === 'GO' ? 'buy' : 'watch'}>
                {brief.risk_state?.mode || 'NORMAL'}
              </Badge>
              <p className="text-[13px] text-text-primary mt-2 leading-relaxed">{brief.one_line_summary}</p>
            </div>

            {/* Key Numbers */}
            {brief.vix !== undefined && (
              <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-overlay rounded-lg">
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase">VIX</p>
                  <MonoNumber value={brief.vix?.toFixed(1) || '—'} className="text-sm" />
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase">Mood</p>
                  <span className={`text-xs font-medium ${
                    brief.news_mood === 'BULLISH' ? 'text-buy' : brief.news_mood === 'BEARISH' ? 'text-sell' : 'text-text-secondary'
                  }`}>{brief.news_mood || 'NEUTRAL'}</span>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-text-muted uppercase">Stocks</p>
                  <MonoNumber value={brief.watchlist_summary?.total_candidates || 0} className="text-sm" />
                </div>
              </div>
            )}

            {/* Top Picks */}
            {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Today's Focus</p>
                <div className="flex gap-2">
                  {brief.watchlist_summary.top_3_by_score.map((s) => (
                    <div key={s.ticker} className="flex-1 bg-surface border border-border-dim rounded-lg p-2 text-center">
                      <span className="font-mono text-xs font-medium text-text-primary">{s.ticker}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            {brief.ai_summary && (
              <div className="mb-4 p-3 bg-surface border border-border-dim rounded-lg">
                <p className="text-[11px] text-text-secondary leading-relaxed">{brief.ai_summary}</p>
              </div>
            )}

            {/* Market Outlook */}
            {brief.market_outlook && (
              <p className="text-xs text-text-secondary mb-4">
                {brief.market_outlook.weather} — {brief.market_outlook.advice}
              </p>
            )}

            <button
              onClick={dismissBrief}
              className="w-full py-3 rounded-lg bg-info text-white text-sm font-medium hover:bg-info/90 transition-colors duration-100"
            >
              START TRADING →
            </button>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">Brief not available yet</p>
            <button onClick={dismissBrief} className="mt-4 text-xs text-info hover:underline">Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
}
