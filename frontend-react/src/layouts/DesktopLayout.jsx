import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, BarChart3, History, Newspaper, Settings, Scale, Filter, Activity } from 'lucide-react';
import LeftPanel from '../panels/LeftPanel';
import CenterPanel from '../panels/CenterPanel';
import RightPanel from '../panels/RightPanel';
import DisconnectedBanner from '../components/shared/DisconnectedBanner';
import { useAppStore } from '../store/useAppStore';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/markets', label: 'Stocks', icon: Radio },
  { path: '/screener', label: 'Screener', icon: Filter },
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
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
        <DisconnectedBanner />
      )}

      {/* Top Nav Bar */}
      <header className="h-12 flex items-center justify-between px-5 border-b border-border-dim bg-surface/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Logo */}
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 mr-4 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-buy to-info flex items-center justify-center">
              <Activity size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold gradient-text">TradePilot</span>
          </button>

          {/* Nav Items */}
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-info/12 text-info shadow-sm'
                    : 'text-text-muted hover:text-text-secondary hover:bg-overlay'
                }`}
              >
                <Icon size={14} strokeWidth={active ? 2 : 1.5} />
                {label}
              </button>
            );
          })}
        </div>

        <StatusIndicator />
      </header>

      {/* 3-Panel Layout */}
      <div className="flex flex-1 min-h-0">
        <aside className="w-[270px] flex-shrink-0 border-r border-border-dim overflow-y-auto bg-surface">
          <LeftPanel />
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto bg-base">
          <CenterPanel />
        </main>

        <aside className="w-[310px] flex-shrink-0 border-l border-border-dim overflow-y-auto bg-surface">
          <RightPanel />
        </aside>
      </div>
    </div>
  );
}

function StatusIndicator() {
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const lastUpdated = useAppStore((s) => s.lastUpdated);

  const isLive = connectionStatus === 'connected' || connectionStatus === 'polling';
  const statusLabel = connectionStatus === 'connected' ? 'LIVE'
    : connectionStatus === 'polling' ? 'DELAYED 5S'
    : connectionStatus === 'reconnecting' ? 'RECONNECTING'
    : 'OFFLINE';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-overlay">
      <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-buy pulse-dot' : 'bg-sell'}`} />
      <span className="text-[10px] text-text-muted font-semibold tracking-wide">{statusLabel}</span>
      {lastUpdated && (
        <span className="text-[10px] text-text-muted font-mono ml-1">
          {new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
        </span>
      )}
    </div>
  );
}
