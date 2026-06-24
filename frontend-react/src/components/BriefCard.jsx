import { Sun, Star } from 'lucide-react'

export default function BriefCard({ brief }) {
  if (!brief) return null

  return (
    <div className="bg-dark-700 border border-purple-500/20 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Sun size={14} className="text-purple-400" />
        <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Morning Brief</span>
      </div>
      <p className="text-sm text-gray-200 leading-relaxed">{brief.one_line_summary}</p>
      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {brief.watchlist_summary.top_3_by_score.map(s => (
            <span key={s.ticker} className="inline-flex items-center gap-1 bg-dark-900 px-2 py-1 rounded-lg text-[11px]">
              <Star size={8} className="text-accent-green" />
              <span className="text-gray-400">{s.ticker}</span>
              <span className="font-semibold text-accent-green">{s.grade}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
