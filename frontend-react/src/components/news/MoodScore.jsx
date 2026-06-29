import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Badge from '../shared/Badge';

export default function MoodScore({ mood, score }) {
  const Icon = mood === 'BULLISH' ? TrendingUp : mood === 'BEARISH' ? TrendingDown : Minus;
  const variant = mood === 'BULLISH' ? 'buy' : mood === 'BEARISH' ? 'sell' : 'neutral';
  const label = mood === 'BULLISH' ? 'Bullish' : mood === 'BEARISH' ? 'Bearish' : 'Neutral';

  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
        mood === 'BULLISH' ? 'bg-buy/12' : mood === 'BEARISH' ? 'bg-sell/12' : 'bg-overlay'
      }`}>
        <Icon size={14} className={mood === 'BULLISH' ? 'text-buy' : mood === 'BEARISH' ? 'text-sell' : 'text-text-muted'} />
      </div>
      <Badge variant={variant}>{label}</Badge>
      {score !== undefined && (
        <span className="text-[10px] font-mono text-text-muted">{score}/100</span>
      )}
    </div>
  );
}
