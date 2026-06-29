import { useState } from 'react';
import { Grid3X3, TrendingUp, TrendingDown } from 'lucide-react';
import { marketApi } from '../../api/market';
import { usePoll } from '../../hooks/usePoll';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import { SkeletonCard } from '../shared/Skeleton';
import ErrorState from '../shared/ErrorState';
import { useAppStore } from '../../store/useAppStore';

export default function MarketSectors() {
  const [sectors, setSectors] = useState(null);
  const [movers, setMovers] = useState(null);
  const [tab, setTab] = useState('sectors');
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      const [s, m] = await Promise.all([
        marketApi.sectors(),
        marketApi.movers(),
      ]);
      setSectors(s.sectors || []);
      setMovers(m);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  usePoll(fetchData, 60000);

  if (error && !sectors) return <ErrorState message="Failed to load market data" onRetry={fetchData} />;
  if (!sectors) return <SkeletonCard />;

  return (
    <div className="px-4 py-3">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3 p-0.5 bg-overlay rounded-lg">
        <TabBtn active={tab === 'sectors'} onClick={() => setTab('sectors')} icon={Grid3X3} label="Sectors" />
        <TabBtn active={tab === 'gainers'} onClick={() => setTab('gainers')} icon={TrendingUp} label="Gainers" />
        <TabBtn active={tab === 'losers'} onClick={() => setTab('losers')} icon={TrendingDown} label="Losers" />
      </div>

      {/* Sectors Grid */}
      {tab === 'sectors' && (
        <div className="grid grid-cols-3 gap-1.5">
          {sectors.slice(0, 9).map((s) => {
            const bg = s.mood === 'POSITIVE' ? 'bg-buy/8 border-buy/20'
              : s.mood === 'NEGATIVE' ? 'bg-sell/8 border-sell/20'
              : 'bg-overlay border-border-dim';
            const textColor = s.mood === 'POSITIVE' ? 'text-buy'
              : s.mood === 'NEGATIVE' ? 'text-sell'
              : 'text-text-muted';
            return (
              <div key={s.sector} className={`border rounded-xl px-2 py-2 text-center ${bg}`}>
                <p className="text-[9px] font-medium truncate text-text-secondary">{s.sector}</p>
                <p className={`text-xs font-mono font-bold mt-0.5 ${textColor}`}>{s.avg_score.toFixed(0)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Gainers */}
      {tab === 'gainers' && movers?.gainers && (
        <div className="space-y-1.5">
          {movers.gainers.map((s, i) => (
            <button key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-overlay rounded-xl px-3 py-2 text-left hover:bg-elevated transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] text-text-muted w-3 font-mono">{i + 1}</span>
                <div>
                  <span className="text-[11px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                  <span className="text-[9px] text-text-muted ml-1.5">{s.sector}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MonoNumber value={`₹${s.ltp?.toFixed(1)}`} className="text-[10px]" />
                <span className="text-[9px] font-mono text-buy font-bold bg-buy/10 px-1.5 py-0.5 rounded">{s.grade}</span>
              </div>
            </button>
          ))}
          {(!movers.gainers || movers.gainers.length === 0) && (
            <p className="text-[10px] text-text-muted text-center py-4">No gainers data</p>
          )}
        </div>
      )}

      {/* Losers */}
      {tab === 'losers' && movers?.losers && (
        <div className="space-y-1.5">
          {movers.losers.map((s, i) => (
            <button key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-overlay rounded-xl px-3 py-2 text-left hover:bg-elevated transition-all">
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] text-text-muted w-3 font-mono">{i + 1}</span>
                <div>
                  <span className="text-[11px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                  <span className="text-[9px] text-text-muted ml-1.5">{s.sector}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MonoNumber value={`₹${s.ltp?.toFixed(1)}`} className="text-[10px]" />
                <span className="text-[9px] font-mono text-sell font-bold bg-sell/10 px-1.5 py-0.5 rounded">{s.grade}</span>
              </div>
            </button>
          ))}
          {(!movers.losers || movers.losers.length === 0) && (
            <p className="text-[10px] text-text-muted text-center py-4">No losers data</p>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
        active ? 'bg-surface text-info shadow-sm' : 'text-text-muted hover:text-text-secondary'
      }`}>
      <Icon size={11} />
      {label}
    </button>
  );
}
