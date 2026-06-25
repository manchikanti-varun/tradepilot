import { useState, useEffect } from 'react'
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react'
import { api } from '../api'

export default function NewsPage() {
  const [news, setNews] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchNews = async () => {
    setLoading(true)
    try { setNews(await api.news()) } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 300000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !news) {
    return <div className="flex items-center justify-center py-20">
      <RefreshCw size={18} className="animate-spin text-gray-500" />
    </div>
  }

  const moodColor = news?.mood === 'BULLISH' ? 'text-green-400' :
    news?.mood === 'BEARISH' ? 'text-red-400' : 'text-gray-400'
  const MoodIcon = news?.mood === 'BULLISH' ? TrendingUp :
    news?.mood === 'BEARISH' ? TrendingDown : Minus

  return (
    <div className="py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-accent-blue" />
          <h2 className="text-base font-bold">Market News</h2>
        </div>
        <button onClick={fetchNews} className="p-1.5 rounded-lg bg-dark-700">
          <RefreshCw size={12} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Market Mood */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-3.5">
        <div className="flex items-center gap-2.5">
          <MoodIcon size={18} className={moodColor} />
          <div>
            <p className={`text-sm font-bold ${moodColor}`}>
              Market is {news?.mood === 'BULLISH' ? 'Positive' : news?.mood === 'BEARISH' ? 'Negative' : 'Neutral'} today
            </p>
            <p className="text-[11px] text-gray-500">
              {news?.mood === 'BULLISH' ? 'Good day to look for trades. Follow your signals.' :
               news?.mood === 'BEARISH' ? 'Be careful today. Only take the best setups.' :
               'No strong direction. Rely on stock-specific technicals.'}
            </p>
          </div>
        </div>
      </div>

      {/* News Items - Simple & Clear */}
      <div className="space-y-2">
        {news?.items?.map((item, i) => (
          <div key={i} className="bg-dark-700 border border-dark-600 rounded-xl p-3">
            {/* Headline */}
            <p className="text-sm text-white leading-relaxed">{item.title}</p>

            {/* What it means (simple explanation) */}
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{item.summary}</p>

            {/* Source + Sentiment */}
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-1.5 h-1.5 rounded-full ${
                item.sentiment === 'BULLISH' ? 'bg-green-400' :
                item.sentiment === 'BEARISH' ? 'bg-red-400' : 'bg-gray-500'
              }`} />
              <span className="text-[10px] text-gray-500">{item.source}</span>
              {item.impact === 'HIGH' && (
                <span className="text-[9px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-medium">Important</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {(!news?.items?.length) && (
        <div className="text-center py-10">
          <Newspaper size={28} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No news right now. Refreshes every 5 minutes.</p>
        </div>
      )}
    </div>
  )
}
