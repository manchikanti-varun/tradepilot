import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { usePoll } from '../../hooks/usePoll';
import { useState } from 'react';
import NewsItem from './NewsItem';
import MoodScore from './MoodScore';
import SectionLabel from '../shared/SectionLabel';
import Spinner from '../shared/Spinner';
import ErrorState from '../shared/ErrorState';

export default function NewsFeed({ compact = false }) {
  const [news, setNews] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchNews = async () => {
    try {
      const data = await settingsApi.news();
      setNews(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  usePoll(fetchNews, 300000);

  const sortedItems = useMemo(() => {
    if (!news?.items) return [];
    return [...news.items].sort((a, b) => (a.hours_ago ?? 999) - (b.hours_ago ?? 999));
  }, [news]);

  if (error && !news) return <ErrorState message="Failed to load news" onRetry={fetchNews} />;
  if (!news) return <div className="py-8 flex justify-center"><Spinner size={20} /></div>;

  const displayItems = compact ? sortedItems.slice(0, 8) : sortedItems;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Market News</SectionLabel>
        <MoodScore mood={news.mood} score={news.mood_score} />
      </div>

      {displayItems.length > 0 ? (
        <div className="bg-surface border border-border-dim rounded-xl overflow-hidden">
          <div className="divide-y divide-border-dim/50 px-4">
            {displayItems.map((item, i) => (
              <NewsItem key={i} item={item} />
            ))}
          </div>
          {compact && sortedItems.length > 8 && (
            <button
              onClick={() => navigate('/news')}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-info font-medium hover:bg-info/5 py-3 border-t border-border-dim transition-colors"
            >
              View all {sortedItems.length} headlines <ArrowRight size={11} />
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-6">No news available</p>
      )}
    </div>
  );
}
