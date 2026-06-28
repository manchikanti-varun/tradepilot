import SignalFeed from '../components/signals/SignalFeed';
import Week52Card from '../components/market/Week52Card';
import PremarketCard from '../components/market/PremarketCard';
import RejectionsBanner from '../components/shared/RejectionsBanner';

export default function CenterPanel() {
  return (
    <div className="h-full overflow-y-auto">
      <SignalFeed />
      <PremarketCard />
      <Week52Card />
      <RejectionsBanner />
    </div>
  );
}
