import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message = 'Failed to load data', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <AlertCircle size={24} className="text-sell" />
      <p className="text-xs text-text-secondary text-center">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-overlay border border-border-dim text-xs text-text-secondary hover:text-text-primary hover:border-border-mid transition-colors duration-100"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}
