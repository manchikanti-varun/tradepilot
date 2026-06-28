import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../../api/settings';
import { usePoll } from '../../hooks/usePoll';
import NewsItem from './NewsItem';
import MoodScore from './MoodScore';
import SectionLabel from '../shared/SectionLabel';
import { SkeletonCard } from '../shared/Skeleton';
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

  usePoll(fetchNews, 300000); // 5 min

  // Always sort by recency — consistent order everywhere
  const sortedItems = useMemo(() => {
    if (!news?.items) return [];
    return [...news.items].sort((a, b) => (a.hours_ago ?? 999) - (b.hours_ago ?? 999));
  }, [news]);

  if (error && !news) return <ErrorState message="Failed to load news" onRetry={fetchNews} />;
  if (!news) return <SkeletonCard />;

  const displayItems = compact ? sortedItems.slice(0, 8) : sortedItems;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Market News</SectionLabel>
        <MoodScore mood={news.mood} score={news.mood_score} />
      </div>

      {displayItems.length > 0 ? (
        <div>
          {displayItems.map((item, i) => (
            <NewsItem key={i} item={item} />
          ))}
          {compact && sortedItems.length > 8 && (
            <button
              onClick={() => navigate('/news')}
              className="w-full text-center text-[10px] text-info hover:underline mt-3 py-2"
            >
              View all {sortedItems.length} headlines →
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-4">No news available</p>
      )}
    </div>
  );
}
