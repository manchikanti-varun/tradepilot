import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message = 'Failed to load data', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-12 h-12 rounded-xl bg-sell/10 flex items-center justify-center">
        <AlertCircle size={22} className="text-sell" />
      </div>
      <p className="text-sm text-text-secondary text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-overlay border border-border-dim text-xs font-medium text-text-secondary hover:text-text-primary hover:border-border-mid transition-all"
        >
          <RefreshCw size={13} />
          Try Again
        </button>
      )}
    </div>
  );
}
