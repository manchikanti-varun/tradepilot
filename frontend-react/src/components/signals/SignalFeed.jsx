import { useState, useEffect } from 'react';
import { Crosshair, Clock, Radio, Calendar, BookOpen, BarChart3, Shield, Settings2 } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import { signalsApi } from '../../api/signals';
import SignalCard from './SignalCard';
import EmptyState from '../shared/EmptyState';
import Spinner from '../shared/Spinner';
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

  useEffect(() => {
    if (isMarketOpen) {
      signalsApi.current()
        .then((data) => {
          useMarketStore.setState({ signals: data.signals || [] });
        })
        .catch(() => {});
    } else {
      setLoadingHistory(true);
      signalsApi.current()
        .then((data) => {
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
      <div className="p-5">
        <div className="bg-sell/8 border border-sell/25 rounded-xl p-5 text-center">
          <div className="w-10 h-10 rounded-xl bg-sell/15 flex items-center justify-center mx-auto mb-3">
            <Shield size={20} className="text-sell" />
          </div>
          <p className="text-sm font-semibold text-sell mb-1">Auto-Stop Active</p>
          <p className="text-xs text-text-secondary mb-3">3 consecutive losses recorded. Scanning paused.</p>
          <p className="text-[11px] text-text-muted">
            Review your last 3 trades before resuming. Reset in Settings.
          </p>
        </div>
      </div>
    );
  }

  // HARD_STOP
  if (riskGate === 'HARD_STOP' && isMarketOpen) {
    return (
      <div className="p-5">
        <EmptyState
          icon={Shield}
          title="Signals paused — risk gate active"
          subtitle="Trading is halted for safety. Wait for conditions to normalize."
        />
      </div>
    );
  }

  // Market closed
  if (!isMarketOpen) {
    const displaySignals = historySignals.length > 0 ? historySignals : signals;

    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>
            {isPostMarket ? "Today's Signals" : 'Last Session'}
          </SectionLabel>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-overlay">
            <Clock size={11} className="text-text-muted" />
            <span className="text-[10px] text-text-muted font-medium">
              {isWeekend ? 'Weekend' : isPostMarket ? 'Closed' : 'Pre-market'}
            </span>
          </div>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex justify-center">
            <Spinner size={20} />
          </div>
        ) : displaySignals.length > 0 ? (
          <>
            <div className="bg-overlay border border-border-dim rounded-xl px-4 py-2.5">
              <p className="text-[11px] text-text-muted flex items-center gap-2">
                <Calendar size={12} />
                {displaySignals[0]?.is_historical
                  ? 'Last session signals (read-only)'
                  : 'Market closed — signals no longer actionable'}
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
          <div className="space-y-3">
            <div className="bg-overlay border border-border-dim rounded-xl p-5 text-center">
              <Calendar size={24} className="text-text-muted mx-auto mb-2" />
              <p className="text-sm font-medium text-text-secondary">
                {isWeekend ? 'Weekend — Market Closed' : isPostMarket ? 'Market Closed for Today' : 'Market Closed'}
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                {isPostMarket ? 'Signals resume tomorrow at 9:20 AM' : 'No signal history from last session.'}
              </p>
            </div>
            <div className="bg-surface border border-border-dim rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3">While you wait</p>
              <div className="space-y-2.5">
                <SuggestionItem icon={BookOpen} text="Review your trade history and journal" />
                <SuggestionItem icon={BarChart3} text="Check Reality Check (returns vs Nifty)" />
                <SuggestionItem icon={Radio} text="Read AI Coach recommendations" />
                <SuggestionItem icon={Settings2} text="Adjust risk settings if needed" />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Market open — no signals
  if (!signals || signals.length === 0) {
    // Check if entry window is closed (after 2:40 PM IST)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = now.getHours();
    const mins = now.getMinutes();
    const isAfterEntryWindow = hours > 14 || (hours === 14 && mins >= 40);

    if (isAfterEntryWindow) {
      return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-14 h-14 rounded-2xl bg-watch/10 flex items-center justify-center mb-4">
            <Clock size={26} className="text-watch" />
          </div>
          <p className="text-sm font-semibold text-text-primary mb-1">Entry window closed</p>
          <p className="text-xs text-text-muted mb-2 text-center max-w-[260px]">
            No new signals after 2:40 PM. The system stops recommending entries
            when there isn't enough time to manage a trade.
          </p>
          <div className="bg-overlay rounded-xl px-4 py-2.5 mt-2">
            <p className="text-[10px] text-text-muted text-center">
              Signals resume tomorrow at <span className="text-info font-semibold">9:20 AM</span>
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-14 h-14 rounded-2xl bg-overlay flex items-center justify-center mb-4">
          <Crosshair size={26} className="text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text-secondary mb-1">No signals in this scan</p>
        <p className="text-xs text-text-muted mb-5">Scanning 200+ stocks every 90s</p>
        <ScanCountdown />
      </div>
    );
  }

  // Active signals
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-buy pulse-dot" />
          <SectionLabel>Active Signals ({signals.length})</SectionLabel>
        </div>
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

function SuggestionItem({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={13} className="text-info shrink-0" />
      <span className="text-[11px] text-text-secondary">{text}</span>
    </div>
  );
}
