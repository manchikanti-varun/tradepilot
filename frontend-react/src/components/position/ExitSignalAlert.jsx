import { AlertOctagon } from 'lucide-react';
import { usePositionStore } from '../../store/usePositionStore';

export default function ExitSignalAlert() {
  const shouldExit = usePositionStore((s) => s.shouldExit);
  const exitUrgency = usePositionStore((s) => s.exitUrgency);
  const exitReason = usePositionStore((s) => s.exitReason);

  if (!shouldExit) return null;

  return (
    <div className="bg-sell/8 border border-sell/25 rounded-xl px-4 py-3 mb-3 animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-sell/15 flex items-center justify-center shrink-0">
          <AlertOctagon size={16} className="text-sell" />
        </div>
        <div>
          <p className="text-xs font-bold text-sell">EXIT — {exitUrgency}</p>
          <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">{exitReason}</p>
        </div>
      </div>
    </div>
  );
}
