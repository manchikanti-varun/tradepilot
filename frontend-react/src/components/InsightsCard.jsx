import { useState, useEffect } from 'react'
import { Brain, Trophy, Clock, AlertTriangle, Lightbulb, Flame, Snowflake } from 'lucide-react'
import { api } from '../api'

const ICON_MAP = {
  trophy: Trophy,
  clock: Clock,
  alert: AlertTriangle,
  lightbulb: Lightbulb,
  flame: Flame,
  snowflake: Snowflake,
}

export default function InsightsCard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.insights().then(setData).catch(() => {})
  }, [])

  if (!data || !data.insights?.length) return null

  return (
    <div className="bg-dark-700 border border-purple-500/20 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={13} className="text-purple-400" />
        <span className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">AI Insights</span>
        <span className="text-[9px] text-gray-600 ml-auto">{data.total_trades} trades</span>
      </div>

      <div className="space-y-2">
        {data.insights.slice(0, 4).map((insight, i) => {
          const Icon = ICON_MAP[insight.icon] || Lightbulb
          return (
            <div key={i} className={`rounded-xl p-3 ${
              insight.type === 'warning' ? 'bg-red-500/8 border border-red-500/20' :
              insight.type === 'streak' ? 'bg-amber-500/8 border border-amber-500/20' :
              insight.type === 'tip' ? 'bg-blue-500/8 border border-blue-500/20' :
              'bg-dark-900 border border-dark-600'
            }`}>
              <div className="flex items-start gap-2.5">
                <Icon size={14} className={
                  insight.type === 'warning' ? 'text-red-400' :
                  insight.type === 'streak' ? 'text-amber-400' :
                  insight.type === 'tip' ? 'text-blue-400' : 'text-green-400'
                } />
                <div>
                  <p className="text-xs font-bold text-white">{insight.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{insight.detail}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
