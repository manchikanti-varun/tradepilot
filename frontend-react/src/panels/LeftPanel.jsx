import MarketPulse from '../components/market/MarketPulse';
import RiskBanner from '../components/market/RiskBanner';
import PositionCard from '../components/position/PositionCard';
import TodayStats from '../components/stats/TodayStats';
import CapitalCard from '../components/stats/CapitalCard';
import LossStreak from '../components/stats/LossStreak';
import MarketSectors from '../components/market/MarketSectors';
import IntakeBar from '../components/shared/IntakeBar';

export default function LeftPanel() {
  return (
    <div className="h-full flex flex-col">
      <MarketPulse />
      <RiskBanner />
      <PositionCard />
      <LossStreak />
      <div className="border-b border-border-dim" />
      <TodayStats />
      <div className="border-b border-border-dim" />
      <CapitalCard />
      <div className="border-b border-border-dim" />
      <IntakeBar />
      <div className="flex-1 overflow-y-auto border-t border-border-dim">
        <MarketSectors />
      </div>
    </div>
  );
}
