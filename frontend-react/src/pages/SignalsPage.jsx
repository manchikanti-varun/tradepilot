import { useState } from 'react';
import SignalFeed from '../components/signals/SignalFeed';
import SignalHistory from '../components/signals/SignalHistory';
import MarketPulse from '../components/market/MarketPulse';
import ScanCountdown from '../components/market/ScanCountdown';
import SectionLabel from '../components/shared/SectionLabel';

export default function SignalsPage() {
  const [tab, setTab] = useState('live');

  return (
    <div>
      {/* Compact market strip */}
      <MarketPulse />

      {/* Tab switcher */}
      <div className="flex border-b border-border-dim px-4">
        <button
          onClick={() => setTab('live')}
          className={`flex-1 py-2.5 text-center text-[11px] uppercase tracking-wider font-medium transition-colors duration-100 ${
            tab === 'live' ? 'text-info border-b-2 border-info' : 'text-text-muted'
          }`}
        >
          Live Signals
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2.5 text-center text-[11px] uppercase tracking-wider font-medium transition-colors duration-100 ${
            tab === 'history' ? 'text-info border-b-2 border-info' : 'text-text-muted'
          }`}
        >
          Signal Log
        </button>
      </div>

      {/* Content */}
      {tab === 'live' && <SignalFeed />}
      {tab === 'history' && (
        <div className="p-4">
          <SignalHistory />
        </div>
      )}
    </div>
  );
}
