import { useState } from 'react';
import WatchlistView from '../components/market/WatchlistView';
import ScreenerView from '../components/market/ScreenerView';

export default function MarketsPage() {
  const [tab, setTab] = useState('watchlist');

  return (
    <div>
      {/* Tab Switcher */}
      <div className="flex border-b border-border-dim px-4 sticky top-0 bg-base z-10">
        <button
          onClick={() => setTab('watchlist')}
          className={`flex-1 py-2.5 text-center text-[11px] uppercase tracking-wider font-medium transition-colors duration-100 ${
            tab === 'watchlist' ? 'text-info border-b-2 border-info' : 'text-text-muted'
          }`}
        >
          Watchlist
        </button>
        <button
          onClick={() => setTab('screener')}
          className={`flex-1 py-2.5 text-center text-[11px] uppercase tracking-wider font-medium transition-colors duration-100 ${
            tab === 'screener' ? 'text-info border-b-2 border-info' : 'text-text-muted'
          }`}
        >
          Screener
        </button>
      </div>

      {/* Content */}
      {tab === 'watchlist' && <WatchlistView />}
      {tab === 'screener' && <ScreenerView />}
    </div>
  );
}
