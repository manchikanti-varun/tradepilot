import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, BarChart3, History, Newspaper, Settings, TrendingUp, Scale } from 'lucide-react';
import LeftPanel from '../panels/LeftPanel';
import CenterPanel from '../panels/CenterPanel';
import RightPanel from '../panels/RightPanel';
import DisconnectedBanner from '../components/shared/DisconnectedBanner';
import { useAppStore } from '../store/useAppStore';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/markets', label: 'Markets', icon: Radio },
  { path: '/news', label: 'News', icon: Newspaper },
  { path: '/history', label: 'History', icon: History },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/reality', label: 'Reality', icon: Scale },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function DesktopLayout() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {connectionStatus === 'disconnected' || connectionStatus === 'reconnecting' ? (
        <DisconnectedBanner />
      ) : null}

      {/* Top Nav Bar */}
      <header className="h-10 flex items-center justify-between px-4 border-b border-border-dim bg-surface shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded bg-buy flex items-center justify-center mr-2">
            <span className="text-white text-[10px] font-bold">TP</span>
          </div>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors duration-100 ${
                  active ? 'bg-info/15 text-info' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Icon size={13} strokeWidth={active ? 2 : 1.5} />
                {label}
              </button>
            );
          })}
        </div>
        <StatusIndicator />
      </header>

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
    </div>
  );
}

function StatusIndicator() {
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
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
      <span className="text-[10px] text-text-muted uppercase tracking-wider">{statusLabel}</span>
      {lastUpdated && (
        <span className="text-[10px] text-text-muted font-mono">
          {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      )}
    </div>
  );
}
