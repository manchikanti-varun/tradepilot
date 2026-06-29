import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';

export default function RiskBanner() {
  const riskGate = useMarketStore((s) => s.riskGate);
  const riskReason = useMarketStore((s) => s.riskReason);
  const { isMarketOpen, isPreMarket } = useMarketHours();

  if (!isMarketOpen && !isPreMarket) {
    if (riskGate === 'GO' || riskGate === 'CLOSED' || !riskGate) return null;
  }

  if (riskGate === 'GO') {
    return (
      <div className="px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={11} className="text-buy" />
          <span className="text-[10px] text-buy uppercase tracking-wider font-semibold">Risk: Normal</span>
        </div>
      </div>
    );
  }

  if (riskGate === 'CLOSED') return null;

  if (riskGate === 'CAUTION') {
    return (
      <div className="mx-4 my-2 px-4 py-3 rounded-xl bg-watch/8 border border-watch/25">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-watch/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={15} className="text-watch" />
          </div>
          <div>
            <p className="text-xs font-semibold text-watch">CAUTION</p>
            <p className="text-[11px] text-text-secondary mt-0.5">{riskReason}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 px-4 py-3 rounded-xl bg-sell/8 border border-sell/25">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sell/15 flex items-center justify-center shrink-0">
          <ShieldAlert size={16} className="text-sell" />
        </div>
        <div>
          <p className="text-sm font-bold text-sell">TRADING HALTED</p>
          <p className="text-[11px] text-text-secondary mt-0.5">{riskReason}</p>
        </div>
      </div>
    </div>
  );
}
