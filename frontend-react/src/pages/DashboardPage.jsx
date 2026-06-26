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
      <div className="px-4 py-3">
        <MorningBrief />
      </div>
      <SignalFeed />
      <MorningBriefModal />
      <KeyboardShortcuts />
      <ToastContainer />
    </div>
  );
}
