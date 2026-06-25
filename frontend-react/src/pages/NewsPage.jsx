import { useState, useEffect } from 'react'
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { api } from '../api'

const MOOD_CONFIG = {
  BULLISH: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', icon: TrendingUp, label: 'Market Mood: Positive' },
  BEARISH: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingDown, label: 'Market Mood: Negative' },
  NEUTRAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: Minus, label: 'Market Mood: Neutral' },
}

const IMPACT_BADGE = {
  HIGH: { text: '⚡ Important', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  MEDIUM: { text: '📌 Notable', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  LOW: { text: 'ℹ️ FYI', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

const SENTIMENT_DOT = {
  BULLISH: 'bg-green-400',
  BEARISH: 'bg-red-400',
  NEUTRAL: 'bg-gray-500',
}

export default function NewsPage() {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchNews = async () => {
    setLoading(true)
    try {
      const data = await api.news()
      setNews(data)
    } catch (e) {
      console.error('News fetch failed', e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 300000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !news) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  const mood = MOOD_CONFIG[news?.mood] || MOOD_CONFIG.NEUTRAL
  const MoodIcon = mood.icon

  return (
    <div className="py-4">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Newspaper size={18} className="text-accent-blue" />
          <h2 className="text-base font-bold">Market News</h2>
        </div>
        <button onClick={fetchNews} className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 transition-colors">
          <RefreshCw size={14} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Overall Mood Card */}
      <div className={`${mood.bg} border ${mood.border} rounded-2xl p-4 mb-4`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${mood.bg} border ${mood.border} flex items-center justify-center`}>
            <MoodIcon size={20} className={mood.color} />
          </div>
          <div>
            <p className={`text-sm font-bold ${mood.color}`}>{mood.label}</p>
            <p className="text-[11px] text-gray-500">
              Reading {news?.count || 0} headlines • Confidence: {news?.mood_score || 50}%
            </p>
          </div>
        </div>
        <div className="mt-3 bg-dark-900/50 rounded-lg p-2.5">
          <p className="text-xs text-gray-300 leading-relaxed">
            <span className="font-semibold text-white">What to do: </span>
            {news?.mood === 'BULLISH' && 'News is positive. If you find a good setup today, go for it with confidence.'}
            {news?.mood === 'BEARISH' && 'News is negative. Either sit out today or only take the absolute best setups with tight stops.'}
            {(!news?.mood || news?.mood === 'NEUTRAL') && 'News is mixed. No strong direction — rely on the chart and technicals to decide.'}
          </p>
        </div>
      </div>

      {/* News Items */}
      <div className="space-y-3">
        {news?.items?.map((item, i) => {
          const impact = IMPACT_BADGE[item.impact] || IMPACT_BADGE.LOW
          const dotColor = SENTIMENT_DOT[item.sentiment] || SENTIMENT_DOT.NEUTRAL
          return (
            <div key={i} className="bg-dark-700 border border-dark-600 rounded-xl p-3.5">
              {/* Headline */}
              <div className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                <p className="text-sm text-white leading-relaxed font-medium">{item.title}</p>
              </div>

              {/* Simple Explanation */}
              <div className="ml-5 mt-2 pl-2 border-l-2 border-dark-500">
                <p className="text-xs text-gray-400 leading-relaxed">{item.summary}</p>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 mt-2.5 ml-5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${impact.cls}`}>
                  {impact.text}
                </span>
                <span className="text-[10px] text-gray-600">• {item.source}</span>
              </div>
            </div>
          )
        })}
      </div>

      {(!news?.items || news.items.length === 0) && (
        <div className="text-center py-10">
          <Newspaper size={32} className="text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No news available right now</p>
          <p className="text-xs text-gray-600 mt-1">Will refresh automatically every 5 minutes</p>
        </div>
      )}
    </div>
  )
}
