import { AlertOctagon } from 'lucide-react';
import { usePositionStore } from '../../store/usePositionStore';

export default function ExitSignalAlert() {
  const shouldExit = usePositionStore((s) => s.shouldExit);
  const exitUrgency = usePositionStore((s) => s.exitUrgency);
  const exitReason = usePositionStore((s) => s.exitReason);

  if (!shouldExit) return null;

  return (
    <div className="bg-sell/[0.12] border border-sell/40 rounded-lg px-3 py-2.5 mb-2">
      <div className="flex items-start gap-2">
        <AlertOctagon size={14} className="text-sell shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-sell">EXIT — {exitUrgency}</p>
          <p className="text-[11px] text-text-secondary mt-0.5">{exitReason}</p>
        </div>
      </div>
    </div>
  );
}
