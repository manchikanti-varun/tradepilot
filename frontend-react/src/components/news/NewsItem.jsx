import { ExternalLink, Clock, Flame } from 'lucide-react';

export default function NewsItem({ item }) {
  const sentimentColor = item.sentiment === 'BULLISH' ? 'bg-buy' : item.sentiment === 'BEARISH' ? 'bg-sell' : 'bg-text-muted';

  const timeAgo = item.hours_ago !== null
    ? item.hours_ago < 1 ? `${Math.round(item.hours_ago * 60)}m`
      : item.hours_ago < 24 ? `${Math.round(item.hours_ago)}h`
      : `${Math.round(item.hours_ago / 24)}d`
    : null;

  return (
    <div className="py-3 border-b border-border-dim/50 last:border-0">
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sentimentColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-text-primary leading-relaxed">{item.title}</p>
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="text-[10px] text-text-muted font-medium">{item.source}</span>
            {timeAgo && (
              <span className="flex items-center gap-0.5 text-[10px] text-text-muted">
                <Clock size={9} />{timeAgo}
              </span>
            )}
            {item.impact === 'HIGH' && (
              <span className="text-[9px] bg-sell/10 text-sell px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-0.5">
                <Flame size={8} /> HIGH
              </span>
            )}
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-info hover:text-info/80 transition-colors">
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
