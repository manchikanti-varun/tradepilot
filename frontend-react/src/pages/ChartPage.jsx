import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { marketApi } from '../api/market';
import MonoNumber from '../components/shared/MonoNumber';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';

const INTERVALS = [
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '1h', label: '1H' },
  { key: '1d', label: 'D' },
];

export default function ChartPage() {
  const { symbol: paramSymbol } = useParams();
  const [symbol, setSymbol] = useState(paramSymbol || 'RELIANCE');
  const [input, setInput] = useState(paramSymbol || 'RELIANCE');
  const [interval, setInterval] = useState('5m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChart = async () => {
    setLoading(true);
    try {
      const res = await marketApi.chart(symbol, interval);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchChart(); }, [symbol, interval]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSymbol(input.toUpperCase().trim());
  };

  const chartData = (data?.candles || []).slice(-80).map((c) => ({
    time: c.time?.slice(11, 16) || c.time?.slice(5, 10) || '',
    close: c.close,
    high: c.high,
    low: c.low,
    volume: c.volume,
    bullish: c.close >= c.open,
  }));

  const lastCandle = chartData[chartData.length - 1];

  if (error && !data) return <div className="p-4"><ErrorState message="Failed to load chart" onRetry={fetchChart} /></div>;

  return (
    <div className="p-4">
      {/* Symbol Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="SYMBOL"
          className="flex-1 bg-surface border border-border-dim rounded-lg px-3 py-2 text-sm font-mono text-text-primary outline-none focus:border-border-mid" />
        <button type="submit" className="px-3 py-2 bg-info text-white rounded-lg text-xs font-medium">Load</button>
      </form>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-mono text-base font-semibold">{symbol}</span>
          {lastCandle && <MonoNumber value={` ₹${lastCandle.close.toFixed(2)}`} className="text-sm ml-2" />}
        </div>
        <button onClick={fetchChart} className="p-1.5 rounded bg-overlay border border-border-dim">
          <RefreshCw size={12} className={`text-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Intervals */}
      <div className="flex gap-1 mb-3">
        {INTERVALS.map(({ key, label }) => (
          <button key={key} onClick={() => setInterval(key)}
            className={`px-3 py-1.5 rounded text-[10px] font-medium ${interval === key ? 'bg-info text-white' : 'bg-overlay text-text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading && !data ? <SkeletonCard /> : chartData.length > 0 ? (
        <>
          <div className="bg-surface border border-border-dim rounded-lg p-3 mb-3">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData}>
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#4A4A58' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#4A4A58' }} tickLine={false} axisLine={false} width={50} />
                <Tooltip content={<CTooltip />} />
                <Line type="monotone" dataKey="close" stroke="#2563EB" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface border border-border-dim rounded-lg p-3">
            <ResponsiveContainer width="100%" height={50}>
              <ComposedChart data={chartData}>
                <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.bullish ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="bg-surface border border-border-dim rounded-lg p-12 text-center">
          <p className="text-xs text-text-muted">{loading ? 'Loading...' : 'No data available'}</p>
        </div>
      )}

      <p className="text-[9px] text-text-muted text-center mt-3 font-mono">
        {data?.count || 0} candles · {interval}
      </p>
    </div>
  );
}

function CTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-elevated border border-border-dim rounded px-2 py-1 text-[10px] font-mono text-text-primary">
      ₹{payload[0].value?.toFixed(2)}
    </div>
  );
}
