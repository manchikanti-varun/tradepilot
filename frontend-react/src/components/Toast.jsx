export default function Toast({ toast, onConfirm, onDismiss }) {
  if (!toast) return null

  const borderColor = {
    success: 'border-accent-green', error: 'border-accent-red',
    warn: 'border-amber-400', confirm: 'border-accent-blue', info: 'border-dark-600',
  }[toast.type] || 'border-dark-600'

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-dark-700 border ${borderColor} rounded-2xl p-4 shadow-2xl z-[999] animate-in`}>
      <p className="text-sm mb-3">{toast.msg}</p>
      {toast.type === 'confirm' && toast.data ? (
        <div className="flex gap-2">
          <button onClick={() => onConfirm(toast.data)}
            className="flex-1 bg-accent-green text-white py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform">
            ✓ Confirm
          </button>
          <button onClick={onDismiss}
            className="flex-1 bg-dark-600 text-gray-300 py-2.5 rounded-xl font-semibold text-sm">
            ✕ Cancel
          </button>
        </div>
      ) : (
        <button onClick={onDismiss}
          className="w-full bg-dark-600 text-gray-300 py-2 rounded-xl text-xs font-medium">
          Dismiss
        </button>
      )}
    </div>
  )
}
