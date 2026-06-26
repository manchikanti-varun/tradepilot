import { useState, useEffect } from 'react';
import { Crosshair, Clock } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import { signalsApi } from '../../api/signals';
import SignalCard from './SignalCard';
import EmptyState from '../shared/EmptyState';
import ScanCountdown from '../market/ScanCountdown';
import SectionLabel from '../shared/SectionLabel';
import { useAppStore } from '../../store/useAppStore';

export default function SignalFeed() {
  const signals = useMarketStore((s) => s.signals);
  const riskGate = useMarketStore((s) => s.riskGate);
  const consecutiveLosses = useMarketStore((s) => s.consecutiveLosses);
  const { isMarketOpen, isPostMarket, isWeekend } = useMarketHours();
  const [historySignals, setHistorySignals] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch last session signals when market is closed
  useEffect(() => {
    if (!isMarketOpen) {
      setLoadingHistory(true);
      signalsApi.current()
        .then((data) => {
          // Backend returns last session's signals when market is closed
          setHistorySignals(data.signals || []);
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [isMarketOpen]);

  const handleViewPlan = (symbol) => {
    useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol });
  };

  const handleSkip = (signal) => {
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

  // HARD_STOP active (but still show historical if market closed)
  if (riskGate === 'HARD_STOP' && isMarketOpen) {
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

  // Market closed — show last session signals
  if (!isMarketOpen) {
    const displaySignals = historySignals.length > 0 ? historySignals : signals;

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>
            {isPostMarket ? "Today's Signals" : 'Last Session'}
          </SectionLabel>
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-text-muted" />
            <span className="text-[10px] text-text-muted">
              {isWeekend ? 'Weekend' : isPostMarket ? 'Market closed' : 'Pre-market'}
            </span>
          </div>
        </div>

        {loadingHistory ? (
          <div className="py-8 flex justify-center">
            <div className="w-4 h-4 border-2 border-border-mid border-t-info rounded-full animate-spin" />
          </div>
        ) : displaySignals.length > 0 ? (
          <>
            <div className="bg-overlay border border-border-dim rounded-lg px-3 py-2 mb-2">
              <p className="text-[11px] text-text-muted">
                {displaySignals[0]?.is_historical
                  ? '📋 Showing signals from last trading session (read-only)'
                  : '📋 Market is closed — these signals are no longer actionable'}
              </p>
            </div>
            {displaySignals.map((signal, i) => (
              <SignalCard
                key={`${signal.symbol}-${i}`}
                signal={{ ...signal, is_expired: true }}
                onViewPlan={handleViewPlan}
                onSkip={null}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon={Crosshair}
            title="No signals from last session"
            subtitle="Signals will appear when market opens"
          />
        )}
      </div>
    );
  }

  // Market open — no signals found
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

  // Active signals (market open)
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
