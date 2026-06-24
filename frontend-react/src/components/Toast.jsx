import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ICONS = {
  success: CheckCircle2, error: XCircle, warn: AlertTriangle, confirm: Info, info: Info,
}
const COLORS = {
  success: 'border-accent-green', error: 'border-accent-red',
  warn: 'border-amber-400', confirm: 'border-accent-blue', info: 'border-dark-600',
}

export default function Toast({ toast, onConfirm, onDismiss }) {
  if (!toast) return null
  const Icon = ICONS[toast.type] || Info
  const border = COLORS[toast.type] || 'border-dark-600'

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] max-w-sm bg-dark-700 border ${border} rounded-2xl p-4 shadow-2xl z-[999]`}>
      <div className="flex gap-3">
        <Icon size={18} className="shrink-0 mt-0.5 text-gray-300" />
        <div className="flex-1">
          <p className="text-sm leading-relaxed">{toast.msg}</p>
          {toast.type === 'confirm' && toast.data && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => onConfirm(toast.data)}
                className="flex-1 bg-accent-green text-white py-2.5 rounded-xl font-bold text-xs active:scale-95 transition-transform">
                Confirm Trade
              </button>
              <button onClick={onDismiss}
                className="flex-1 bg-dark-600 text-gray-300 py-2.5 rounded-xl font-semibold text-xs">
                Cancel
              </button>
            </div>
          )}
        </div>
        {toast.type !== 'confirm' && (
          <button onClick={onDismiss} className="shrink-0"><X size={14} className="text-gray-500" /></button>
        )}
      </div>
    </div>
  )
}
