import { useState, useEffect } from 'react';
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

  if (error && !news) return <ErrorState message="Failed to load news" onRetry={fetchNews} />;
  if (!news) return <SkeletonCard />;

  const items = news.items || [];
  const displayItems = compact ? items.slice(0, 6) : items;

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
          {compact && items.length > 6 && (
            <p className="text-[10px] text-text-muted text-center mt-2">
              +{items.length - 6} more headlines
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-4">No news available</p>
      )}
    </div>
  );
}
