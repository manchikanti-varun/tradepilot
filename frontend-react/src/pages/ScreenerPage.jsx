import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Flame, Zap } from 'lucide-react';
import { marketApi } from '../api/market';
import { useAppStore } from '../store/useAppStore';
import SectionLabel from '../components/shared/SectionLabel';
import MonoNumber from '../components/shared/MonoNumber';
import Badge from '../components/shared/Badge';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';

const TIMEFRAMES = [
  { key: '5m', label: '5 Min' },
  { key: '15m', label: '15 Min' },
  { key: '1h', label: '1 Hour' },
  { key: '1d', label: '1 Day' },
  { key: '1w', label: '1 Week' },
];

export default function ScreenerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('1h');
  const [view, setView] = useState('bullish');

  const fetchData = async (tf) => {
    setLoading(true);
    try {
      const res = await marketApi.screenerTimeframe(tf || timeframe);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const changeTimeframe = (tf) => {
    setTimeframe(tf);
    fetchData(tf);
  };

  const stocks = data?.[view] || [];
  const bullCount = data?.bullish?.length || 0;
  const bearCount = data?.bearish?.length || 0;
  const kstSignals = data?.kst_signals || [];

  if (error && !data) return <div className="p-4"><ErrorState message="Failed to load screener" onRetry={() => fetchData()} /></div>;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SectionLabel>Screener</SectionLabel>
        <button onClick={() => fetchData()} className="p-1.5 rounded bg-overlay border border-border-dim">
          <RefreshCw size={12} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeframe */}
      <div className="flex gap-1 bg-surface border border-border-dim rounded-lg p-1">
        {TIMEFRAMES.map((tf) => (
          <button key={tf.key} onClick={() => changeTimeframe(tf.key)}
            className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors duration-100 ${
              timeframe === tf.key ? 'bg-info text-white' : 'text-text-muted'
            }`}>{tf.label}</button>
        ))}
      </div>

      {/* Bullish/Bearish Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('bullish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border ${
            view === 'bullish' ? 'bg-buy/10 border-buy/30 text-buy' : 'bg-surface border-border-dim text-text-muted'
          }`}>
          <TrendingUp size={13} /> Bullish ({bullCount})
        </button>
        <button onClick={() => setView('bearish')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border ${
            view === 'bearish' ? 'bg-sell/10 border-sell/30 text-sell' : 'bg-surface border-border-dim text-text-muted'
          }`}>
          <TrendingDown size={13} /> Bearish ({bearCount})
        </button>
      </div>

      {/* Stock List */}
      {loading && !data ? <SkeletonCard /> : stocks.length > 0 ? (
        <div className="space-y-1">
          {stocks.map((s) => (
            <button key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-surface border border-border-dim rounded-lg px-3 py-2 text-left hover:border-border-mid transition-colors duration-100">
              <div className="flex items-center gap-2">
                <StrengthIcon strength={s.strength} />
                <span className="text-[11px] font-mono font-medium text-text-primary">{s.symbol}</span>
                <span className="text-[9px] text-text-muted">{s.sector}</span>
              </div>
              <div className="flex items-center gap-2">
                <MonoNumber value={`₹${s.ltp}`} className="text-[10px]" />
                <MonoNumber
                  value={`${s.change_pct >= 0 ? '+' : ''}${s.change_pct}%`}
                  color={s.change_pct >= 0 ? 'buy' : 'sell'}
                  className="text-[10px]"
                />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-8">No stocks for this timeframe</p>
      )}

      {/* KST Signals */}
      {kstSignals.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={12} className="text-watch" />
            <span className="text-[10px] uppercase tracking-wider text-watch font-medium">KST Crossover</span>
          </div>
          <div className="space-y-1">
            {kstSignals.map((s, i) => (
              <button key={i}
                onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
                className={`w-full rounded-lg px-3 py-2 text-left border ${
                  s.kst_direction === 'BULLISH' ? 'bg-buy/5 border-buy/20' : 'bg-sell/5 border-sell/20'
                }`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-mono font-medium text-text-primary">{s.symbol}</span>
                  <Badge variant={s.kst_direction === 'BULLISH' ? 'buy' : 'sell'}>{s.kst_direction}</Badge>
                </div>
                <p className="text-[9px] text-text-muted">{s.kst_reason}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {data && (
        <p className="text-[9px] text-text-muted text-center">
          {data.total_scanned} stocks • {timeframe} timeframe
        </p>
      )}
    </div>
  );
}

function StrengthIcon({ strength }) {
  if (strength === 'STRONG') return <Flame size={10} className="text-buy" />;
  if (strength === 'MEDIUM') return <div className="w-2 h-2 rounded-full bg-info" />;
  return <div className="w-1.5 h-1.5 rounded-full bg-text-muted" />;
}
