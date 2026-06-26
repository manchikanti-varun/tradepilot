import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Badge from '../shared/Badge';

export default function MoodScore({ mood, score }) {
  const Icon = mood === 'BULLISH' ? TrendingUp : mood === 'BEARISH' ? TrendingDown : Minus;
  const variant = mood === 'BULLISH' ? 'buy' : mood === 'BEARISH' ? 'sell' : 'neutral';
  const label = mood === 'BULLISH' ? 'Positive' : mood === 'BEARISH' ? 'Negative' : 'Neutral';

  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className={mood === 'BULLISH' ? 'text-buy' : mood === 'BEARISH' ? 'text-sell' : 'text-text-muted'} />
      <Badge variant={variant}>{label}</Badge>
      {score !== undefined && (
        <span className="text-[10px] font-mono text-text-muted">{score}/100</span>
      )}
    </div>
  );
}
