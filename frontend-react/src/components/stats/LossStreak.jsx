import { useMarketStore } from '../../store/useMarketStore';

export default function LossStreak() {
  const consecutiveLosses = useMarketStore((s) => s.consecutiveLosses);

  if (consecutiveLosses === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: consecutiveLosses }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-sell" />
          ))}
        </div>
        <span className="text-[10px] text-text-secondary">
          {consecutiveLosses} consecutive loss{consecutiveLosses > 1 ? 'es' : ''}
        </span>
      </div>
      {consecutiveLosses === 2 && (
        <p className="text-[10px] text-watch mt-1">1 more loss triggers auto-stop</p>
      )}
    </div>
  );
}
