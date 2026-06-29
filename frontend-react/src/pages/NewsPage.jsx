import { useState, useEffect, useMemo } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Brain, Filter, Flame } from 'lucide-react';
import { settingsApi } from '../api/settings';
import { usePoll } from '../hooks/usePoll';
import NewsItem from '../components/news/NewsItem';
import MoodScore from '../components/news/MoodScore';
import SectionLabel from '../components/shared/SectionLabel';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';

const SENTIMENT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'bullish', label: 'Bullish' },
  { id: 'bearish', label: 'Bearish' },
  { id: 'high', label: 'Important' },
];

const SOURCE_FILTERS = [
  { id: 'all', label: 'All Sources' },
  { id: 'market', label: 'Market' },
  { id: 'global', label: 'Global' },
];

export default function NewsPage() {
  const [news, setNews] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const fetchNews = async () => {
    try {
      const data = await settingsApi.news();
      setNews(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews();
    settingsApi.newsAnalysis().then(setAnalysis).catch(() => {});
  }, []);

  usePoll(fetchNews, 300000, { immediate: false });

  const filteredItems = useMemo(() => {
    if (!news?.items) return [];
    let items = [...news.items];
    items.sort((a, b) => (a.hours_ago ?? 999) - (b.hours_ago ?? 999));

    if (sentimentFilter === 'bullish') items = items.filter((i) => i.sentiment === 'BULLISH');
    else if (sentimentFilter === 'bearish') items = items.filter((i) => i.sentiment === 'BEARISH');
    else if (sentimentFilter === 'high') items = items.filter((i) => i.impact === 'HIGH');

    if (sourceFilter === 'market') {
      const marketSources = ['Moneycontrol', 'ET Markets', 'Livemint', 'NDTV', 'Business Standard'];
      items = items.filter((i) => marketSources.some((s) => i.source?.includes(s)));
    } else if (sourceFilter === 'global') {
      const globalSources = ['Reuters', 'CNBC', 'Bloomberg', 'Yahoo Finance'];
      items = items.filter((i) => globalSources.some((s) => i.source?.includes(s)));
    }

    return items;
  }, [news, sentimentFilter, sourceFilter]);

  if (error && !news) return <div className="p-4"><ErrorState message="Failed to load news" onRetry={fetchNews} /></div>;
  if (loading && !news) return <div className="p-4"><SkeletonCard /></div>;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SectionLabel>Market News</SectionLabel>
          <span className="text-[10px] text-text-muted font-mono">{filteredItems.length}</span>
        </div>
        {news && <MoodScore mood={news.mood} score={news.mood_score} />}
      </div>

      {/* AI Analysis */}
      {analysis?.analysis && (
        <div className="bg-conflicting/5 border border-conflicting/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-conflicting/15 flex items-center justify-center">
              <Brain size={12} className="text-conflicting" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-conflicting font-semibold">AI Analysis</span>
          </div>
          <p className="text-[12px] text-text-secondary leading-relaxed mb-3">{analysis.analysis.summary}</p>
          {analysis.analysis.sectors_positive?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <TrendingUp size={10} className="text-buy" />
              {analysis.analysis.sectors_positive.map((s) => (
                <span key={s} className="text-[9px] bg-buy/10 text-buy px-2 py-0.5 rounded-md font-medium">{s}</span>
              ))}
            </div>
          )}
          {analysis.analysis.sectors_negative?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              <TrendingDown size={10} className="text-sell" />
              {analysis.analysis.sectors_negative.map((s) => (
                <span key={s} className="text-[9px] bg-sell/10 text-sell px-2 py-0.5 rounded-md font-medium">{s}</span>
              ))}
            </div>
          )}
          {analysis.analysis.trader_advice && (
            <p className="text-[10px] text-watch mt-2 font-medium">{analysis.analysis.trader_advice}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        <div className="flex gap-1 p-0.5 bg-overlay rounded-lg">
          {SENTIMENT_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setSentimentFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                sentimentFilter === f.id ? 'bg-surface text-info shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}>{f.label}</button>
          ))}
        </div>
        <div className="flex gap-1 p-0.5 bg-overlay rounded-lg">
          {SOURCE_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setSourceFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                sourceFilter === f.id ? 'bg-surface text-conflicting shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* News List */}
      {filteredItems.length > 0 ? (
        <div>
          {filteredItems.map((item, i) => (
            <NewsItem key={i} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-8">No news matching filters</p>
      )}
    </div>
  );
}
