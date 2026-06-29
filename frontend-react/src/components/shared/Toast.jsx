import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const CONFIG = {
  success: { icon: CheckCircle2, border: 'border-buy/40', bg: 'bg-buy/5', iconColor: 'text-buy' },
  error: { icon: AlertCircle, border: 'border-sell/40', bg: 'bg-sell/5', iconColor: 'text-sell' },
  warning: { icon: AlertTriangle, border: 'border-watch/40', bg: 'bg-watch/5', iconColor: 'text-watch' },
  info: { icon: Info, border: 'border-info/40', bg: 'bg-info/5', iconColor: 'text-info' },
};

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9998] flex flex-col gap-2.5 max-w-sm">
      {toasts.map((toast) => {
        const config = CONFIG[toast.type] || CONFIG.info;
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 ${config.bg} border ${config.border} rounded-xl p-4 shadow-2xl backdrop-blur-sm animate-slide-in`}
          >
            <Icon size={16} className={`shrink-0 mt-0.5 ${config.iconColor}`} />
            <p className="text-xs text-text-primary flex-1 leading-relaxed">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 p-0.5 rounded hover:bg-overlay transition-colors">
              <X size={13} className="text-text-muted hover:text-text-primary" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
