import { useState, useEffect, useMemo } from 'react'
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, Brain, ExternalLink, Clock, Filter, AlertTriangle, Flame, Globe, BarChart2 } from 'lucide-react'
import { api } from '../api'

const SENTIMENT_FILTERS = [
  { id: 'all', label: 'All', icon: null },
  { id: 'bullish', label: 'Bullish', icon: TrendingUp, color: 'text-green-400' },
  { id: 'bearish', label: 'Bearish', icon: TrendingDown, color: 'text-red-400' },
  { id: 'high', label: 'Important', icon: Flame, color: 'text-amber-400' },
]

const SOURCE_CATEGORIES = [
  { id: 'all', label: 'All Sources' },
  { id: 'market', label: 'Market' },
  { id: 'global', label: 'Global' },
  { id: 'social', label: 'Community' },
]

export default function NewsPage() {
  const [news, setNews] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [sentimentFilter, setSentimentFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

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

  // Sort by latest first + apply filters
  const filteredItems = useMemo(() => {
    if (!news?.items) return []

    let items = [...news.items]

    // Sort by recency — items with hours_ago come first (lower = newer)
    items.sort((a, b) => {
      const aTime = a.hours_ago ?? 999
      const bTime = b.hours_ago ?? 999
      return aTime - bTime
    })

    // Sentiment filter
    if (sentimentFilter === 'bullish') {
      items = items.filter(i => i.sentiment === 'BULLISH')
    } else if (sentimentFilter === 'bearish') {
      items = items.filter(i => i.sentiment === 'BEARISH')
    } else if (sentimentFilter === 'high') {
      items = items.filter(i => i.impact === 'HIGH')
    }

    // Source category filter
    if (sourceFilter !== 'all') {
      const sourceMap = {
        market: ['Moneycontrol', 'ET Markets', 'ET Stocks', 'Livemint', 'NDTV', 'Business Standard', 'Financial Express', 'Investing.com'],
        global: ['Reuters', 'CNBC', 'Bloomberg', 'Yahoo Finance', 'MarketWatch'],
        social: ['TradingView', 'Reddit', 'Zerodha'],
      }
      const keywords = sourceMap[sourceFilter] || []
      items = items.filter(i => keywords.some(k => i.source.includes(k)))
    }

    return items
  }, [news, sentimentFilter, sourceFilter])

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
          <span className="text-[10px] text-gray-500 bg-dark-700 px-1.5 py-0.5 rounded">{filteredItems.length}</span>
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
            <p className="text-[10px] text-gray-500">
              Sentiment score: {news?.mood_score}/100 &middot; {news?.count} headlines analyzed
            </p>
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
              <TrendingUp size={10} className="text-green-400" />
              {analysis.analysis.sectors_positive.map(s => (
                <span key={s} className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}

          {analysis.analysis.sectors_negative?.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <TrendingDown size={10} className="text-red-400" />
              {analysis.analysis.sectors_negative.map(s => (
                <span key={s} className="text-[9px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          )}

          {analysis.analysis.trader_advice && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-300 mt-2 bg-dark-900/50 rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={10} className="shrink-0 mt-0.5" />
              <span>{analysis.analysis.trader_advice}</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Sentiment Filter Tabs */}
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-gray-500 mr-1" />
          {SENTIMENT_FILTERS.map(f => {
            const Icon = f.icon
            const active = sentimentFilter === f.id
            return (
              <button key={f.id} onClick={() => setSentimentFilter(f.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  active ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/40' : 'bg-dark-700 text-gray-400 border border-transparent hover:text-gray-200'
                }`}>
                {Icon && <Icon size={11} className={active ? 'text-accent-blue' : f.color} />}
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Source Category Filter */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <Globe size={12} className="text-gray-500 mr-1 shrink-0" />
          {SOURCE_CATEGORIES.map(f => {
            const active = sourceFilter === f.id
            return (
              <button key={f.id} onClick={() => setSourceFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
                  active ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'bg-dark-700 text-gray-500 border border-transparent hover:text-gray-300'
                }`}>
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* News Items — sorted by latest first */}
      <div className="space-y-2">
        {filteredItems.map((item, i) => (
          <div key={i} className="bg-dark-700 border border-dark-600 rounded-xl p-3">
            {/* Headline */}
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
              {/* Sentiment indicator */}
              <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded ${
                item.sentiment === 'BULLISH' ? 'bg-green-500/10 text-green-400' :
                item.sentiment === 'BEARISH' ? 'bg-red-500/10 text-red-400' : 'bg-dark-600 text-gray-500'
              }`}>
                {item.sentiment === 'BULLISH' ? <TrendingUp size={8} /> :
                 item.sentiment === 'BEARISH' ? <TrendingDown size={8} /> :
                 <Minus size={8} />}
                {item.sentiment === 'BULLISH' ? 'Bullish' :
                 item.sentiment === 'BEARISH' ? 'Bearish' : 'Neutral'}
              </div>

              {/* Source */}
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                item.source.includes('Reuters') || item.source.includes('CNBC') || item.source.includes('Bloomberg') ? 'bg-blue-500/10 text-blue-400' :
                item.source.includes('TradingView') || item.source.includes('Reddit') || item.source.includes('Varsity') ? 'bg-purple-500/10 text-purple-400' :
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
                <span className="flex items-center gap-0.5 text-[8px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-medium">
                  <Flame size={8} /> Important
                </span>
              )}
              {item.impact === 'MEDIUM' && (
                <span className="flex items-center gap-0.5 text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                  <BarChart2 size={8} /> Notable
                </span>
              )}

              {/* Read link */}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-[9px] text-accent-blue hover:underline ml-auto">
                  <ExternalLink size={8} /> Source
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && news?.items?.length > 0 && (
        <div className="text-center py-8">
          <Filter size={24} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No news matching this filter.</p>
          <button onClick={() => { setSentimentFilter('all'); setSourceFilter('all') }}
            className="text-xs text-accent-blue mt-2 hover:underline">Clear filters</button>
        </div>
      )}

      {(!news?.items?.length) && (
        <div className="text-center py-10">
          <Newspaper size={28} className="mx-auto text-gray-600 mb-2" />
          <p className="text-xs text-gray-500">No news right now. Refreshes every 5 minutes.</p>
        </div>
      )}
    </div>
  )
}
