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

  // Countdown text
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
    <div className="px-4 py-3 border-b border-border-dim">
      {/* Row 1: Status + Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <span className="font-mono text-xs text-text-primary">{formatted}</span>
          {countdown && (
            <span className="text-[9px] text-text-muted font-mono">· {countdown}</span>
          )}
        </div>
        {/* Risk indicator (compact) */}
        {riskGate && riskGate !== 'GO' && (
          <Badge variant={riskGate === 'HARD_STOP' ? 'sell' : 'watch'}>{riskGate}</Badge>
        )}
      </div>

      {/* Row 2: VIX (only if available) */}
      {vix !== null && (
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase text-text-muted">VIX</span>
            <span className={`font-mono text-[11px] font-medium ${vixColor}`}>{vix.toFixed(1)}</span>
            <VixBar vix={vix} />
          </div>
        </div>
      )}
    </div>
  );
}

function VixBar({ vix }) {
  // VIX visual: 0-30 range mapped to a tiny bar
  const pct = Math.min(100, (vix / 30) * 100);
  const color = vix > 22 ? 'bg-sell' : vix > 15 ? 'bg-watch' : 'bg-buy';

  return (
    <div className="w-12 h-1 bg-border-dim rounded-full overflow-hidden ml-1">
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}
