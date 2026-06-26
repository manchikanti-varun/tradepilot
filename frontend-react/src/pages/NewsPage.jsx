import NewsFeed from '../components/news/NewsFeed';

export default function NewsPage() {
  return (
    <div className="p-4">
      <NewsFeed compact={false} />
    </div>
  );
}
