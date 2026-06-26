import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import MonoNumber from '../shared/MonoNumber';

export default function QuickStats() {
  const vix = useMarketStore((s) => s.vix);
  const riskGate = useMarketStore((s) => s.riskGate);
  const marketMode = useMarketStore((s) => s.marketMode);
  const { isMarketOpen, minutesUntilOpen, minutesUntilClose, isPostMarket, isWeekend } = useMarketHours();

  const riskColor = riskGate === 'GO' ? 'buy' : riskGate === 'CAUTION' ? 'watch' : 'sell';
  const vixColor = vix > 22 ? 'sell' : vix > 15 ? 'watch' : 'buy';

  // Market countdown
  let countdownText = '';
  if (isWeekend) {
    countdownText = 'Weekend';
  } else if (isMarketOpen) {
    const h = Math.floor(minutesUntilClose / 60);
    const m = minutesUntilClose % 60;
    countdownText = `Closes in ${h}h ${m}m`;
  } else if (isPostMarket) {
    countdownText = 'Closed';
  } else {
    const h = Math.floor(minutesUntilOpen / 60);
    const m = minutesUntilOpen % 60;
    countdownText = `Opens in ${h}h ${m}m`;
  }

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-4 gap-1.5">
        <StatBox label="VIX" value={vix !== null ? vix.toFixed(1) : '—'} color={vixColor} />
        <StatBox label="Risk" value={riskGate || 'GO'} color={riskColor} />
        <StatBox label="Mode" value={marketMode || 'NORMAL'} />
        <StatBox label="Market" value={countdownText} />
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-surface border border-border-dim rounded-md p-2 text-center">
      <MonoNumber value={value} color={color} className="text-[11px] font-medium" />
      <p className="text-[8px] text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}
