import MarketPulse from '../components/market/MarketPulse';
import RiskBanner from '../components/market/RiskBanner';
import PositionCard from '../components/position/PositionCard';
import TodayStats from '../components/stats/TodayStats';
import CapitalCard from '../components/stats/CapitalCard';
import LossStreak from '../components/stats/LossStreak';
import MarketSectors from '../components/market/MarketSectors';

export default function LeftPanel() {
  return (
    <div className="h-full flex flex-col">
      <MarketPulse />
      <RiskBanner />
      <PositionCard />
      <LossStreak />
      <TodayStats />
      <CapitalCard />
      <div className="flex-1 overflow-y-auto">
        <MarketSectors />
      </div>
    </div>
  );
}
