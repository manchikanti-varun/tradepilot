import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Flame, Zap } from 'lucide-react';
import { marketApi } from '../../api/market';
import { useAppStore } from '../../store/useAppStore';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import Spinner from '../shared/Spinner';
import ErrorState from '../shared/ErrorState';

const TIMEFRAMES = [
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '1h', label: '1H' },
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
];

export default function ScreenerView() {
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
      <div className="flex items-center justify-between">
        <SectionLabel>{data ? `${data.total_scanned} stocks scanned` : 'Loading...'}</SectionLabel>
        <button onClick={() => fetchData()} className="p-2 rounded-lg bg-overlay border border-border-dim hover:border-border-mid transition-all">
          <RefreshCw size={13} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Timeframe Pills */}
      <div className="flex gap-1 p-1 bg-overlay rounded-xl">
        {TIMEFRAMES.map((tf) => (
          <button key={tf.key} onClick={() => changeTimeframe(tf.key)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
              timeframe === tf.key ? 'bg-info text-white shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>{tf.label}</button>
        ))}
      </div>

      {/* Bullish/Bearish Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setView('bullish')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            view === 'bullish' ? 'bg-buy/10 border-buy/25 text-buy' : 'bg-surface border-border-dim text-text-muted hover:text-text-secondary'
          }`}>
          <TrendingUp size={14} /> Bullish ({bullCount})
        </button>
        <button onClick={() => setView('bearish')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
            view === 'bearish' ? 'bg-sell/10 border-sell/25 text-sell' : 'bg-surface border-border-dim text-text-muted hover:text-text-secondary'
          }`}>
          <TrendingDown size={14} /> Bearish ({bearCount})
        </button>
      </div>

      {/* Stock List */}
      {loading && !data ? <div className="py-8 flex justify-center"><Spinner size={20} /></div> : stocks.length > 0 ? (
        <div className="space-y-1.5">
          {stocks.map((s) => (
            <button key={s.symbol}
              onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
              className="w-full flex items-center justify-between bg-surface border border-border-dim rounded-xl px-4 py-2.5 text-left hover:border-info/20 transition-all">
              <div className="flex items-center gap-2.5">
                <StrengthIcon strength={s.strength} />
                <div>
                  <span className="text-[12px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                  <span className="text-[10px] text-text-muted ml-2">{s.sector}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <MonoNumber value={`₹${s.ltp}`} className="text-[11px] font-semibold" />
                <span className={`text-[10px] font-mono font-semibold ${s.change_pct >= 0 ? 'text-buy' : 'text-sell'}`}>
                  {s.change_pct >= 0 ? '+' : ''}{s.change_pct}%
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center py-10">No stocks for this timeframe</p>
      )}

      {/* KST Signals */}
      {kstSignals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border-dim">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-watch" />
            <span className="text-[10px] uppercase tracking-wider text-watch font-semibold">KST Crossover</span>
          </div>
          <div className="space-y-1.5">
            {kstSignals.map((s, i) => (
              <button key={i}
                onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: s.symbol })}
                className={`w-full rounded-xl px-4 py-3 text-left border transition-all hover:scale-[1.01] ${
                  s.kst_direction === 'BULLISH' ? 'bg-buy/5 border-buy/20' : 'bg-sell/5 border-sell/20'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                  <Badge variant={s.kst_direction === 'BULLISH' ? 'buy' : 'sell'}>{s.kst_direction}</Badge>
                </div>
                <p className="text-[10px] text-text-muted">{s.kst_reason}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StrengthIcon({ strength }) {
  if (strength === 'STRONG') return <Flame size={12} className="text-buy" />;
  if (strength === 'MEDIUM') return <div className="w-2.5 h-2.5 rounded-full bg-info" />;
  return <div className="w-2 h-2 rounded-full bg-text-muted" />;
}
