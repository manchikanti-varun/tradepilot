import { WifiOff, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function DisconnectedBanner() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const lastUpdated = useAppStore((s) => s.lastUpdated);

  if (connectionStatus === 'connected' || connectionStatus === 'polling') return null;

  const isReconnecting = connectionStatus === 'reconnecting';

  return (
    <div className={`h-9 flex items-center justify-center gap-2 text-xs font-medium ${
      isReconnecting ? 'bg-watch/15 text-watch' : 'bg-sell/15 text-sell'
    }`}>
      {isReconnecting ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          <span>Connection lost — reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff size={12} />
          <span>No connection — data is stale</span>
          {lastUpdated && (
            <span className="text-text-muted ml-2">
              Last updated: {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          )}
        </>
      )}
    </div>
  );
}
