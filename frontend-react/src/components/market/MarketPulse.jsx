import { Activity, Shield } from 'lucide-react';
import { useIST } from '../../hooks/useIST';
import { useMarketStore } from '../../store/useMarketStore';
import { useMarketHours } from '../../hooks/useMarketHours';
import Badge from '../shared/Badge';

export default function MarketPulse() {
  const { formatted } = useIST();
  const vix = useMarketStore((s) => s.vix);
  const marketStatus = useMarketStore((s) => s.marketStatus);
  const riskGate = useMarketStore((s) => s.riskGate);
  const { isMarketOpen, minutesUntilOpen, minutesUntilClose } = useMarketHours();

  const vixColor = vix > 22 ? 'text-sell' : vix > 15 ? 'text-watch' : 'text-buy';
  const statusVariant = marketStatus === 'OPEN' ? 'buy' : marketStatus === 'PRE_MARKET' ? 'watch' : 'neutral';
  const statusLabel = marketStatus === 'OPEN' ? 'OPEN' : marketStatus === 'PRE_MARKET' ? 'PRE' : 'CLOSED';

  let countdown = '';
  if (isMarketOpen && minutesUntilClose > 0) {
    const h = Math.floor(minutesUntilClose / 60);
    const m = minutesUntilClose % 60;
    countdown = `${h}h ${m}m left`;
  } else if (!isMarketOpen && minutesUntilOpen > 0 && minutesUntilOpen < 600) {
    const h = Math.floor(minutesUntilOpen / 60);
    const m = minutesUntilOpen % 60;
    countdown = `opens in ${h}h ${m}m`;
  }

  return (
    <div className="px-4 py-3 border-b border-border-dim bg-surface/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <span className="font-mono text-xs font-semibold text-text-primary">{formatted}</span>
          {countdown && (
            <span className="text-[10px] text-text-muted font-mono">· {countdown}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {vix !== null && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-overlay">
              <Activity size={10} className={vixColor} />
              <span className="text-[10px] text-text-muted">VIX</span>
              <span className={`font-mono text-[11px] font-semibold ${vixColor}`}>{vix?.toFixed(1)}</span>
            </div>
          )}
          {riskGate && riskGate !== 'GO' && (
            <Badge variant={riskGate === 'HARD_STOP' ? 'sell' : 'watch'}>
              <Shield size={9} className="mr-0.5" />{riskGate}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
