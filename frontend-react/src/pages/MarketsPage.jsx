import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, ArrowUpDown } from 'lucide-react';
import { marketApi } from '../api/market';
import { useAppStore } from '../store/useAppStore';
import SectionLabel from '../components/shared/SectionLabel';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';
import MonoNumber from '../components/shared/MonoNumber';
import Badge from '../components/shared/Badge';

export default function MarketsPage() {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Watchlist {data ? `(${filtered.length})` : ''}</SectionLabel>
        <button onClick={fetchData} className="p-1.5 rounded bg-overlay border border-border-dim">
          <RefreshCw size={12} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol or sector..."
          className="w-full bg-surface border border-border-dim rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary outline-none focus:border-border-mid placeholder:text-text-muted"
        />
      </div>

      {/* Sort */}
      <div className="flex gap-1 mb-3">
        {['composite', 'ltp', 'rsi'].map((key) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
              sortBy === key ? 'bg-info/15 text-info' : 'bg-overlay text-text-muted'
            }`}
          >
            {key === 'composite' ? 'Score' : key.toUpperCase()}
            {sortBy === key && <ArrowUpDown size={9} />}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && !data ? <SkeletonCard /> : (
        <div className="space-y-1">
          {filtered.map((s) => (
            <button
              key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-surface border border-border-dim rounded-lg px-3 py-2 text-left hover:border-border-mid transition-colors duration-100"
            >
              <div>
                <span className="text-xs font-mono font-medium text-text-primary">{s.symbol}</span>
                <span className="text-[9px] text-text-muted ml-2">{s.sector}</span>
              </div>
              <div className="flex items-center gap-2">
                <MonoNumber value={`₹${s.ltp?.toFixed(1)}`} className="text-[11px]" />
                <MonoNumber value={s.composite?.toFixed(0)} className="text-[10px] text-text-muted" />
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
