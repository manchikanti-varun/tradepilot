import { useState } from 'react'
import { Bell, X, Crosshair, AlertOctagon, ShieldAlert, TrendingUp } from 'lucide-react'

const TYPE_CONFIG = {
  signal: {
    icon: Crosshair,
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    iconColor: 'text-green-400',
    label: 'New Signal',
  },
  exit: {
    icon: AlertOctagon,
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    iconColor: 'text-red-400',
    label: 'Exit Alert',
  },
  risk: {
    icon: ShieldAlert,
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-400',
    label: 'Risk Alert',
  },
  profit: {
    icon: TrendingUp,
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    iconColor: 'text-green-400',
    label: 'Profit Update',
  },
}

export default function NotificationBanner({ notifications, onDismiss, onDismissAll }) {
  const [expanded, setExpanded] = useState(false)

  if (!notifications || notifications.length === 0) return null

  const latest = notifications[0]
  const config = TYPE_CONFIG[latest.type] || TYPE_CONFIG.signal
  const Icon = config.icon

  return (
    <div className="fixed top-0 left-0 right-0 z-[1000] px-3 pt-2">
      {/* Main banner */}
      <div className={`${config.bg} border ${config.border} rounded-2xl p-3.5 shadow-2xl backdrop-blur-md`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl ${config.bg} border ${config.border} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={config.iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${config.iconColor}`}>{config.label}</span>
              <span className="text-[10px] text-gray-500">{latest.time}</span>
            </div>
            <p className="text-sm text-white font-medium mt-0.5 leading-relaxed">{latest.title}</p>
            {latest.detail && (
              <p className="text-xs text-gray-400 mt-1">{latest.detail}</p>
            )}
          </div>
          <button onClick={() => onDismiss(latest.id)} className="flex-shrink-0 p-1">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        {/* Show count if more notifications */}
        {notifications.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full text-center text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? 'Hide' : `+${notifications.length - 1} more alerts`}
          </button>
        )}
      </div>

      {/* Expanded list */}
      {expanded && notifications.length > 1 && (
        <div className="mt-1.5 space-y-1.5 max-h-60 overflow-y-auto">
          {notifications.slice(1).map((notif) => {
            const nc = TYPE_CONFIG[notif.type] || TYPE_CONFIG.signal
            const NIcon = nc.icon
            return (
              <div key={notif.id} className={`${nc.bg} border ${nc.border} rounded-xl p-3 backdrop-blur-md`}>
                <div className="flex items-center gap-2.5">
                  <NIcon size={14} className={nc.iconColor} />
                  <p className="text-xs text-gray-200 flex-1">{notif.title}</p>
                  <button onClick={() => onDismiss(notif.id)}>
                    <X size={12} className="text-gray-500" />
                  </button>
                </div>
              </div>
            )
          })}
          <button
            onClick={onDismissAll}
            className="w-full text-center text-[11px] text-gray-500 hover:text-white py-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
