import { Newspaper, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const MOOD_CONFIG = {
  BULLISH: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: TrendingUp, label: 'Bullish' },
  BEARISH: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingDown, label: 'Bearish' },
  NEUTRAL: { color: 'text-gray-400', bg: 'bg-dark-700', border: 'border-dark-600', icon: Minus, label: 'Neutral' },
}

function SentimentDot({ sentiment }) {
  if (sentiment === 'BULLISH') return <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
  if (sentiment === 'BEARISH') return <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
  return <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
}

export default function NewsCard({ news }) {
  if (!news || !news.items || news.items.length === 0) return null

  const mood = MOOD_CONFIG[news.mood] || MOOD_CONFIG.NEUTRAL
  const MoodIcon = mood.icon

  return (
    <div className={`${mood.bg} border ${mood.border} rounded-2xl p-4 mb-3`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className={mood.color} />
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Market News</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${mood.bg} border ${mood.border}`}>
          <MoodIcon size={12} className={mood.color} />
          <span className={`text-[10px] font-bold ${mood.color}`}>{mood.label}</span>
        </div>
      </div>

      {/* News Items */}
      <div className="space-y-2.5">
        {news.items.slice(0, 8).map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <SentimentDot sentiment={item.sentiment} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 leading-relaxed line-clamp-2">{item.title}</p>
              <span className="text-[10px] text-gray-500">{item.source}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {news.count > 8 && (
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          +{news.count - 8} more headlines
        </p>
      )}
    </div>
  )
}
