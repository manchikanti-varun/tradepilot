import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'border-buy',
  error: 'border-sell',
  warning: 'border-watch',
  info: 'border-info',
};

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || Info;
        const borderColor = COLORS[toast.type] || 'border-border-dim';

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 bg-elevated border ${borderColor} rounded-lg p-3 shadow-lg animate-slide-in`}
          >
            <Icon size={16} className="shrink-0 mt-0.5 text-text-secondary" />
            <p className="text-xs text-text-primary flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="shrink-0">
              <X size={12} className="text-text-muted hover:text-text-primary" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
