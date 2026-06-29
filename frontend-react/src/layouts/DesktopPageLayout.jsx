import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, BarChart3, History, Newspaper, Settings, Scale, Filter, Activity } from 'lucide-react';
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

export default function DesktopPageLayout() {
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

        {/* Right side - connection status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' || connectionStatus === 'polling' ? 'bg-buy pulse-dot' : 'bg-sell'
          }`} />
          <span className="text-[10px] text-text-muted font-mono">
            {connectionStatus === 'polling' ? 'LIVE' : connectionStatus?.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto bg-base">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
