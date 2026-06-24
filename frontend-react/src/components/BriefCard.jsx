export default function BriefCard({ brief }) {
  if (!brief) return null

  return (
    <div className="bg-dark-700 border border-purple-500/20 rounded-2xl p-4 mb-3">
      <p className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold mb-2">
        ☀️ Morning Brief
      </p>
      <p className="text-sm text-gray-200 leading-relaxed">{brief.one_line_summary}</p>
      {brief.watchlist_summary?.top_3_by_score?.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {brief.watchlist_summary.top_3_by_score.map(s => (
            <span key={s.ticker} className="bg-dark-900 px-2 py-0.5 rounded text-[11px] text-gray-400">
              {s.ticker} <span className="text-accent-green font-semibold">{s.grade}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
