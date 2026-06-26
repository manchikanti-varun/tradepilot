import { Crosshair } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import SignalCard from './SignalCard';
import EmptyState from '../shared/EmptyState';
import ScanCountdown from '../market/ScanCountdown';
import SectionLabel from '../shared/SectionLabel';
import { useAppStore } from '../../store/useAppStore';

export default function SignalFeed() {
  const signals = useMarketStore((s) => s.signals);
  const riskGate = useMarketStore((s) => s.riskGate);
  const consecutiveLosses = useMarketStore((s) => s.consecutiveLosses);
  const { isMarketOpen, isPostMarket, minutesUntilOpen, isWeekend } = useMarketHours();

  const handleViewPlan = (symbol) => {
    useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol });
  };

  const handleSkip = (signal) => {
    // Remove from local display — signal will be filtered server-side on next refresh
    useMarketStore.setState((s) => ({
      signals: s.signals.filter((sig) => sig.symbol !== signal.symbol),
    }));
  };

  // Auto-stop state
  if (consecutiveLosses >= 3) {
    return (
      <div className="p-6">
        <div className="bg-sell/[0.12] border border-sell/40 rounded-lg p-5 text-center">
          <p className="text-sm font-medium text-sell mb-2">⚠ AUTO-STOP ACTIVE</p>
          <p className="text-xs text-text-secondary mb-1">3 consecutive losses recorded</p>
          <p className="text-xs text-text-secondary mb-1">Signal scanning is paused</p>
          <p className="text-[11px] text-text-muted mt-3">
            Review your last 3 trades before resuming. Come back tomorrow or manually reset in Settings.
          </p>
        </div>
      </div>
    );
  }

  // Pre-market / closed
  if (!isMarketOpen && !isPostMarket) {
    const countdownDisplay = isWeekend
      ? 'Market closed (Weekend)'
      : `Market opens in ${Math.floor(minutesUntilOpen / 60)}h ${minutesUntilOpen % 60}m`;

    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <p className="text-lg font-mono text-text-secondary mb-2">{countdownDisplay}</p>
        <p className="text-xs text-text-muted">Signals will appear after market opens</p>
      </div>
    );
  }

  // Post-market
  if (isPostMarket) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <p className="text-sm text-text-secondary mb-2">Market closed for today</p>
        <p className="text-xs text-text-muted">Check History for today's trades</p>
      </div>
    );
  }

  // HARD_STOP active
  if (riskGate === 'HARD_STOP') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Crosshair}
          title="Signals paused — risk gate active"
          subtitle="Trading is halted. Wait for conditions to normalize."
        />
      </div>
    );
  }

  // No signals
  if (!signals || signals.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <Crosshair size={28} className="text-text-muted mb-3" />
        <p className="text-sm text-text-secondary mb-1">No signals found in this scan</p>
        <p className="text-xs text-text-muted mb-4">Scanning 200+ stocks every 90s</p>
        <ScanCountdown />
      </div>
    );
  }

  // Active signals
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Active Signals ({signals.length})</SectionLabel>
        <ScanCountdown />
      </div>
      {signals.map((signal, i) => (
        <SignalCard
          key={`${signal.symbol}-${i}`}
          signal={signal}
          onViewPlan={handleViewPlan}
          onSkip={handleSkip}
        />
      ))}
    </div>
  );
}
