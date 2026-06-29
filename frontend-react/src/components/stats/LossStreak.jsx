import { AlertTriangle } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';

export default function LossStreak() {
  const consecutiveLosses = useMarketStore((s) => s.consecutiveLosses);

  if (consecutiveLosses === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="bg-sell/8 border border-sell/20 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={13} className="text-sell shrink-0" />
          <div className="flex items-center gap-1.5">
            {Array.from({ length: consecutiveLosses }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-sell" />
            ))}
          </div>
          <span className="text-[11px] text-text-secondary font-medium">
            {consecutiveLosses} consecutive loss{consecutiveLosses > 1 ? 'es' : ''}
          </span>
        </div>
        {consecutiveLosses === 2 && (
          <p className="text-[10px] text-watch mt-1.5 ml-6">⚠ 1 more triggers auto-stop</p>
        )}
      </div>
    </div>
  );
}
