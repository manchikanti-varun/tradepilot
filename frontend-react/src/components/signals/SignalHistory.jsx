import { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { signalsApi } from '../../api/signals';
import SectionLabel from '../shared/SectionLabel';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import { SkeletonCard } from '../shared/Skeleton';

export default function SignalHistory() {
  const [signals, setSignals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    signalsApi.history(20)
      .then((data) => setSignals(data.signals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard />;

  if (!signals || signals.length === 0) {
    return (
      <div className="text-center py-8">
        <History size={20} className="mx-auto text-text-muted mb-2" />
        <p className="text-xs text-text-muted">No signal history yet</p>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel className="mb-3 block">Signal Log</SectionLabel>
      <div className="space-y-1.5">
        {signals.map((s) => (
          <div key={s.id} className="bg-overlay rounded-md px-3 py-2 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono font-medium text-text-primary">{s.symbol}</span>
              <span className="text-[9px] text-text-muted ml-2">{s.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <MonoNumber value={`₹${s.ltp?.toFixed(0)}`} className="text-[10px]" />
              <Badge variant={s.grade === 'A' || s.grade === 'A+' ? 'buy' : s.grade === 'B' ? 'watch' : 'neutral'}>
                {s.grade}
              </Badge>
              {s.outcome && (
                <Badge variant={s.outcome === 'WIN' ? 'buy' : s.outcome === 'LOSS' ? 'sell' : 'neutral'}>
                  {s.outcome}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
