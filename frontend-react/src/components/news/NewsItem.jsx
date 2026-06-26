import { ExternalLink, Clock } from 'lucide-react';

export default function NewsItem({ item }) {
  const sentimentColor = item.sentiment === 'BULLISH' ? 'bg-buy' : item.sentiment === 'BEARISH' ? 'bg-sell' : 'bg-text-muted';

  const timeAgo = item.hours_ago !== null
    ? item.hours_ago < 1 ? `${Math.round(item.hours_ago * 60)}m`
      : item.hours_ago < 24 ? `${Math.round(item.hours_ago)}h`
      : `${Math.round(item.hours_ago / 24)}d`
    : null;

  return (
    <div className="py-2.5 border-b border-border-dim last:border-0">
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${sentimentColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-primary leading-relaxed">{item.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] text-text-muted">{item.source}</span>
            {timeAgo && (
              <span className="flex items-center gap-0.5 text-[9px] text-text-muted">
                <Clock size={8} />{timeAgo}
              </span>
            )}
            {item.impact === 'HIGH' && (
              <span className="text-[8px] bg-sell/15 text-sell px-1 rounded font-medium">HIGH</span>
            )}
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-info">
                <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
