import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, ArrowUpDown } from 'lucide-react';
import { marketApi } from '../../api/market';
import { useAppStore } from '../../store/useAppStore';
import SectionLabel from '../shared/SectionLabel';
import Spinner from '../shared/Spinner';
import ErrorState from '../shared/ErrorState';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import FavoritesBar from './FavoritesBar';

export default function WatchlistView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('composite');
  const [sortDir, setSortDir] = useState('desc');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await marketApi.watchlist();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!data?.stocks) return [];
    let stocks = [...data.stocks];
    if (search) {
      const q = search.toLowerCase();
      stocks = stocks.filter((s) => s.symbol.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q));
    }
    stocks.sort((a, b) => {
      const av = a[sortBy] || 0;
      const bv = b[sortBy] || 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return stocks;
  }, [data, search, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  if (error && !data) return <div className="p-4"><ErrorState message="Failed to load watchlist" onRetry={fetchData} /></div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>{data ? `${filtered.length} stocks` : 'Loading...'}</SectionLabel>
        <button onClick={fetchData} className="p-2 rounded-lg bg-overlay border border-border-dim hover:border-border-mid transition-all">
          <RefreshCw size={13} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <FavoritesBar />

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol or sector..."
          className="w-full bg-surface border border-border-dim rounded-xl pl-10 pr-4 py-2.5 text-xs text-text-primary outline-none focus:border-info focus:ring-1 focus:ring-info/20 placeholder:text-text-muted transition-all"
        />
      </div>

      {/* Sort Pills */}
      <div className="flex gap-1.5 mb-3 p-0.5 bg-overlay rounded-lg w-fit">
        {[['composite', 'Score'], ['ltp', 'Price'], ['rsi', 'RSI']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all ${
              sortBy === key ? 'bg-surface text-info shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {label}
            {sortBy === key && <ArrowUpDown size={9} />}
          </button>
        ))}
      </div>

      {/* Stock List */}
      {loading && !data ? <div className="py-8 flex justify-center"><Spinner size={20} /></div> : (
        <div className="space-y-1.5">
          {filtered.map((s) => (
            <button
              key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-surface border border-border-dim rounded-xl px-4 py-2.5 text-left hover:border-info/20 hover:bg-info/[0.02] transition-all"
            >
              <div>
                <span className="text-[12px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                <span className="text-[10px] text-text-muted ml-2">{s.sector}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MonoNumber value={`₹${s.ltp?.toFixed(1)}`} className="text-[11px] font-semibold" />
                <span className="text-[10px] font-mono text-text-muted w-6 text-right">{s.composite?.toFixed(0)}</span>
                <Badge variant={s.grade === 'A+' ? 'buy' : s.grade === 'A' ? 'info' : s.grade === 'B' ? 'watch' : 'neutral'}>
                  {s.grade}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
