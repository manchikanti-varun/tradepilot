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
import MarketSectors from '../components/market/MarketSectors';
import SectionLabel from '../components/shared/SectionLabel';

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

  // Mobile layout — enhanced
  return (
    <div className="pb-4">
      {/* Header Strip */}
      <div className="sticky top-0 z-40 bg-base/95 backdrop-blur-md">
        <MarketPulse />
      </div>

      {/* Risk Alert */}
      <RiskBanner />

      {/* Active Position (sticky when in trade) */}
      <PositionCard />

      {/* Trade Input */}
      <IntakeBar />

      {/* Quick Stats Row */}
      <QuickStats />

      {/* Morning Brief */}
      <div className="px-4 pt-2 pb-3">
        <MorningBrief />
      </div>

      {/* Capital + Tier */}
      <CapitalCard />

      {/* Divider */}
      <div className="mx-4 my-2 border-t border-border-dim" />

      {/* Signals */}
      <SignalFeed />

      {/* Divider */}
      <div className="mx-4 my-2 border-t border-border-dim" />

      {/* Market Data */}
      <div className="px-4 pt-2">
        <SectionLabel className="block mb-2">Market Overview</SectionLabel>
      </div>
      <PremarketCard />
      <Week52Card />
      <MarketSectors />

      {/* Rejections */}
      <RejectionsBanner />

      {/* Modals */}
      <MorningBriefModal />
      <KeyboardShortcuts />
      <ToastContainer />
    </div>
  );
}
