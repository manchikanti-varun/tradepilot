import { useState } from 'react';
import { Radio, History } from 'lucide-react';
import SignalFeed from '../components/signals/SignalFeed';
import SignalHistory from '../components/signals/SignalHistory';
import MarketPulse from '../components/market/MarketPulse';

export default function SignalsPage() {
  const [tab, setTab] = useState('live');

  return (
    <div>
      <MarketPulse />

      {/* Tab switcher */}
      <div className="flex gap-1 px-4 py-2 border-b border-border-dim">
        <button
          onClick={() => setTab('live')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'live'
              ? 'bg-info/12 text-info'
              : 'text-text-muted hover:text-text-secondary hover:bg-overlay'
          }`}
        >
          <Radio size={13} />
          Live Signals
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
            tab === 'history'
              ? 'bg-info/12 text-info'
              : 'text-text-muted hover:text-text-secondary hover:bg-overlay'
          }`}
        >
          <History size={13} />
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
