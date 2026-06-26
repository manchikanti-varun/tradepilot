import { useAppStore } from '../store/useAppStore';
import DesktopLayout from '../layouts/DesktopLayout';
import MarketPulse from '../components/market/MarketPulse';
import RiskBanner from '../components/market/RiskBanner';
import PositionCard from '../components/position/PositionCard';
import SignalFeed from '../components/signals/SignalFeed';
import MorningBrief from '../components/brief/MorningBrief';
import MorningBriefModal from '../components/brief/MorningBriefModal';
import KeyboardShortcuts from '../components/shared/KeyboardShortcuts';
import ToastContainer from '../components/shared/Toast';
import IntakeBar from '../components/shared/IntakeBar';
import CapitalCard from '../components/stats/CapitalCard';
import QuickStats from '../components/stats/QuickStats';
import RejectionsBanner from '../components/shared/RejectionsBanner';
import Week52Card from '../components/market/Week52Card';
import PremarketCard from '../components/market/PremarketCard';

export default function DashboardPage() {
  const isMobile = useAppStore((s) => s.isMobile);

  if (!isMobile) {
    return (
      <>
        <DesktopLayout />
        <MorningBriefModal />
        <KeyboardShortcuts />
        <ToastContainer />
      </>
    );
  }

  // Mobile layout
  return (
    <div className="pb-4">
      <MarketPulse />
      <RiskBanner />
      <PositionCard />
      <IntakeBar />
      <QuickStats />
      <div className="px-4 py-3">
        <MorningBrief />
      </div>
      <CapitalCard />
      <SignalFeed />
      <PremarketCard />
      <Week52Card />
      <RejectionsBanner />
      <MorningBriefModal />
      <KeyboardShortcuts />
      <ToastContainer />
    </div>
  );
}
