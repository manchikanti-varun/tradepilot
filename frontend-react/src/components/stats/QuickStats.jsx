import { Activity, Shield, Gauge, Clock } from 'lucide-react';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';

export default function QuickStats() {
  const vix = useMarketStore((s) => s.vix);
  const riskGate = useMarketStore((s) => s.riskGate);
  const marketMode = useMarketStore((s) => s.marketMode);
  const { isMarketOpen, minutesUntilOpen, minutesUntilClose, isPostMarket, isWeekend } = useMarketHours();

  const riskColor = riskGate === 'GO' ? 'text-buy' : riskGate === 'CAUTION' ? 'text-watch' : 'text-sell';
  const vixColor = vix > 22 ? 'text-sell' : vix > 15 ? 'text-watch' : 'text-buy';

  let countdownText = '';
  if (isWeekend) countdownText = 'Weekend';
  else if (isMarketOpen) {
    const h = Math.floor(minutesUntilClose / 60);
    const m = minutesUntilClose % 60;
    countdownText = `${h}h ${m}m left`;
  } else if (isPostMarket) countdownText = 'Closed';
  else {
    const h = Math.floor(minutesUntilOpen / 60);
    const m = minutesUntilOpen % 60;
    countdownText = `${h}h ${m}m`;
  }

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-4 gap-2">
        <StatBox icon={Activity} label="VIX" value={vix !== null ? vix.toFixed(1) : '—'} valueColor={vixColor} />
        <StatBox icon={Shield} label="Risk" value={riskGate || 'GO'} valueColor={riskColor} />
        <StatBox icon={Gauge} label="Mode" value={marketMode || 'NORMAL'} valueColor="text-text-primary" />
        <StatBox icon={Clock} label="Market" value={countdownText} valueColor="text-text-primary" />
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, valueColor = 'text-text-primary' }) {
  return (
    <div className="bg-surface border border-border-dim rounded-xl p-2.5 text-center">
      <Icon size={12} className="text-text-muted mx-auto mb-1" />
      <p className={`text-[11px] font-mono font-semibold ${valueColor} truncate`}>{value}</p>
      <p className="text-[9px] text-text-muted uppercase mt-0.5">{label}</p>
    </div>
  );
}
