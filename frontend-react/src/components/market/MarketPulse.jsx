import { useIST } from '../../hooks/useIST';
import { useMarketStore } from '../../store/useMarketStore';
import Badge from '../shared/Badge';

export default function MarketPulse() {
  const { formatted } = useIST();
  const vix = useMarketStore((s) => s.vix);
  const marketStatus = useMarketStore((s) => s.marketStatus);

  const vixColor = vix > 22 ? 'text-sell' : vix > 15 ? 'text-watch' : 'text-buy';
  const statusVariant = marketStatus === 'OPEN' ? 'buy' : marketStatus === 'PRE_MARKET' ? 'watch' : 'neutral';
  const statusLabel = marketStatus === 'OPEN' ? 'OPEN' : marketStatus === 'PRE_MARKET' ? 'PRE' : 'CLOSED';

  return (
    <div className="px-4 py-3 border-b border-border-dim">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          <span className="font-mono text-xs text-text-primary">{formatted}</span>
        </div>
        {vix !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-section uppercase text-text-muted">VIX</span>
            <span className={`font-mono text-xs font-medium ${vixColor}`}>{vix.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
