import { useState, useEffect } from 'react';
import { History, Clock } from 'lucide-react';
import { signalsApi } from '../../api/signals';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import Spinner from '../shared/Spinner';

export default function SignalHistory() {
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signalsApi.history(20)
      .then((data) => setSignals(data.signals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-8 flex justify-center"><Spinner size={20} /></div>;

  if (!signals || signals.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-xl bg-overlay flex items-center justify-center mx-auto mb-3">
          <History size={22} className="text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">No signal history yet</p>
        <p className="text-xs text-text-muted mt-1">Signals will appear here after market scans</p>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel className="mb-3 block">Signal Log ({signals.length})</SectionLabel>
      <div className="space-y-2">
        {signals.map((s) => (
          <div key={s.id} className="bg-overlay rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-mono font-semibold text-text-primary">{s.symbol}</span>
                <Badge variant={s.grade === 'A' || s.grade === 'A+' ? 'buy' : s.grade === 'B' ? 'watch' : 'neutral'}>
                  {s.grade}
                </Badge>
              </div>
              <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                <Clock size={9} /> {s.date}
              </span>
            </div>
            <div className="flex items-center gap-2 text-right">
              <MonoNumber value={`₹${s.ltp?.toFixed(0)}`} className="text-[11px] font-semibold" />
              {s.outcome && (
                <Badge variant={s.outcome === 'TARGET_HIT' ? 'buy' : s.outcome === 'STOP_HIT' ? 'sell' : 'neutral'}>
                  {s.outcome === 'TARGET_HIT' ? 'WIN' : s.outcome === 'STOP_HIT' ? 'LOSS' : 'NEUTRAL'}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
