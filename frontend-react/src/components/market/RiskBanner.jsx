import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import { useState, useEffect } from 'react';

export default function RiskBanner() {
  const riskGate = useMarketStore((s) => s.riskGate);
  const riskReason = useMarketStore((s) => s.riskReason);
  const { isMarketOpen, isPreMarket } = useMarketHours();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (riskGate === 'HARD_STOP') {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);
    }
  }, [riskGate]);

  // Market closed/holiday — don't show "Risk: Normal", it's misleading
  if (!isMarketOpen && !isPreMarket) {
    // If risk gate is explicitly set (HARD_STOP/CAUTION) show it, otherwise hide
    if (riskGate === 'GO' || riskGate === 'CLOSED' || !riskGate) {
      return null; // Don't show anything — market is closed, risk is irrelevant
    }
  }

  if (riskGate === 'GO') {
    return (
      <div className="px-4 py-1.5">
        <span className="text-[10px] text-buy uppercase tracking-wider font-medium">Risk: Normal</span>
      </div>
    );
  }

  if (riskGate === 'CLOSED') {
    return null; // Backend explicitly says closed — don't show risk banner
  }

  if (riskGate === 'CAUTION') {
    return (
      <div className="mx-3 my-2 px-3 py-2.5 rounded-lg bg-watch/[0.12] border border-watch/40">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-watch shrink-0" />
          <div>
            <p className="text-xs font-medium text-watch">CAUTION</p>
            <p className="text-[11px] text-text-secondary mt-0.5">{riskReason}</p>
          </div>
        </div>
      </div>
    );
  }

  // HARD_STOP
  return (
    <div className={`mx-3 my-2 px-3 py-3 rounded-lg bg-sell/[0.15] border border-sell/50 ${flash ? 'animate-hard-stop' : ''}`}>
      <div className="flex items-center gap-2">
        <ShieldAlert size={20} className="text-sell shrink-0" />
        <div>
          <p className="text-sm font-medium text-sell">TRADING HALTED</p>
          <p className="text-[11px] text-text-secondary mt-0.5">{riskReason}</p>
        </div>
      </div>
    </div>
  );
}
