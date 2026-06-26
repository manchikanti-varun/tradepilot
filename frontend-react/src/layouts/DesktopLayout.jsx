import LeftPanel from '../panels/LeftPanel';
import CenterPanel from '../panels/CenterPanel';
import RightPanel from '../panels/RightPanel';
import DisconnectedBanner from '../components/shared/DisconnectedBanner';
import { useAppStore } from '../store/useAppStore';

export default function DesktopLayout() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {connectionStatus === 'disconnected' || connectionStatus === 'reconnecting' ? (
        <DisconnectedBanner />
      ) : null}

      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Fixed 260px */}
        <aside className="w-[260px] flex-shrink-0 border-r border-border-dim overflow-y-auto bg-surface">
          <LeftPanel />
        </aside>

        {/* Center Panel - Flexible */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-base">
          <CenterPanel />
        </main>

        {/* Right Panel - Fixed 300px */}
        <aside className="w-[300px] flex-shrink-0 border-l border-border-dim overflow-y-auto bg-surface">
          <RightPanel />
        </aside>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  );
}

function StatusBar() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const lastUpdated = useAppStore((s) => s.lastUpdated);

  const statusDot = connectionStatus === 'connected'
    ? 'bg-buy'
    : connectionStatus === 'polling'
    ? 'bg-watch'
    : connectionStatus === 'reconnecting'
    ? 'bg-watch animate-pulse-slow'
    : 'bg-sell';

  const statusLabel = connectionStatus === 'connected'
    ? 'LIVE'
    : connectionStatus === 'polling'
    ? 'DELAYED 5s'
    : connectionStatus === 'reconnecting'
    ? 'RECONNECTING'
    : 'OFFLINE';

  return (
    <div className="h-8 flex items-center justify-between px-4 border-t border-border-dim bg-surface text-[10px]">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
        <span className="text-text-muted uppercase tracking-wider">{statusLabel}</span>
      </div>
      {lastUpdated && (
        <span className="text-text-muted font-mono">
          Last: {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      )}
    </div>
  );
}
