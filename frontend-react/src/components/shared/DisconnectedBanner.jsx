import { WifiOff, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function DisconnectedBanner() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const lastUpdated = useAppStore((s) => s.lastUpdated);

  if (connectionStatus === 'connected' || connectionStatus === 'polling') return null;

  const isReconnecting = connectionStatus === 'reconnecting';

  return (
    <div className={`h-10 flex items-center justify-center gap-2.5 text-xs font-medium border-b ${
      isReconnecting
        ? 'bg-watch/8 text-watch border-watch/20'
        : 'bg-sell/8 text-sell border-sell/20'
    }`}>
      {isReconnecting ? (
        <>
          <Loader2 size={13} className="animate-spin" />
          <span>Reconnecting to server...</span>
        </>
      ) : (
        <>
          <WifiOff size={13} />
          <span>Connection lost — data may be stale</span>
          {lastUpdated && (
            <span className="text-text-muted ml-2 text-[10px]">
              Last: {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          )}
        </>
      )}
    </div>
  );
}
