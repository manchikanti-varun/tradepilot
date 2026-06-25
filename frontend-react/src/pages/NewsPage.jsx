import { useState, useEffect } from 'react'
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Brain, ExternalLink, Clock } from 'lucide-react'
import { api } from '../api'

export default function NewsPage() {
  const [news, setNews] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchNews = async () => {
    setLoading(true)
    try { setNews(await api.news()) } catch (e) { console.error(e) }
    setLoading(false)
  }

  const fetchAnalysis = async () => {
    setAnalyzing(true)
    try { setAnalysis(await api.newsAnalysis()) } catch (e) { console.error(e) }
    setAnalyzing(false)
  }

  useEffect(() => {
    fetchNews()
    fetchAnalysis()
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
            <p className="text-[10px] text-gray-500">Score: {news?.mood_score}/100</p>
          </div>
        </div>
      </div>

      {/* AI News Analysis */}
      {analysis?.analysis && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={13} className="text-purple-400" />
            <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">AI News Analysis</span>
          </div>
          <p className="text-xs text-gray-200 leading-relaxed mb-2">{analysis.analysis.summary}</p>

          {analysis.analysis.sectors_positive?.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[9px] text-green-400 font-bold">Positive for:</span>
              {analysis.analysis.sectors_positive.map(s => (
                <span key={s} className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}

          {analysis.analysis.sectors_negative?.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[9px] text-red-400 font-bold">Negative for:</span>
              {analysis.analysis.sectors_negative.map(s => (
                <span key={s} className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}

          {analysis.analysis.trader_advice && (
            <p className="text-[10px] text-amber-300 mt-2 bg-dark-900/50 rounded-lg px-2.5 py-1.5">
              {analysis.analysis.trader_advice}
            </p>
          )}
        </div>
      )}

      {/* News Items */}
      <div className="space-y-2">
        {news?.items?.map((item, i) => (
          <div key={i} className="bg-dark-700 border border-dark-600 rounded-xl p-3">
            {/* Headline */}
            {/* Headline — clickable if link exists */}
            {item.link ? (
              <a href={item.link} target="_blank" rel="noopener noreferrer"
                className="text-sm text-white leading-relaxed hover:text-accent-blue transition-colors block">
                {item.title}
              </a>
            ) : (
              <p className="text-sm text-white leading-relaxed">{item.title}</p>
            )}

            {/* Explanation */}
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{item.summary}</p>

            {/* Meta Row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Sentiment dot */}
              <div className={`w-1.5 h-1.5 rounded-full ${
                item.sentiment === 'BULLISH' ? 'bg-green-400' :
                item.sentiment === 'BEARISH' ? 'bg-red-400' : 'bg-gray-500'
              }`} />

              {/* Source with category */}
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                item.source.includes('Reuters') || item.source.includes('CNBC') ? 'bg-blue-500/10 text-blue-400' :
                item.source.includes('TradingView') || item.source.includes('Varsity') ? 'bg-purple-500/10 text-purple-400' :
                'bg-dark-600 text-gray-500'
              }`}>{item.source}</span>

              {/* Time ago */}
              {item.hours_ago !== null && (
                <span className="flex items-center gap-0.5 text-[9px] text-gray-600">
                  <Clock size={8} />
                  {item.hours_ago < 1 ? `${Math.round(item.hours_ago * 60)}m ago` :
                   item.hours_ago < 24 ? `${Math.round(item.hours_ago)}h ago` :
                   `${Math.round(item.hours_ago / 24)}d ago`}
                </span>
              )}

              {/* Impact badge */}
              {item.impact === 'HIGH' && (
                <span className="text-[8px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-medium">Important</span>
              )}

              {/* Read Full Article */}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-[9px] text-accent-blue hover:underline ml-auto">
                  <ExternalLink size={8} /> Read full →
                </a>
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
