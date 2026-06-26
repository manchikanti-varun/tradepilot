import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Radio, BarChart3, History, Newspaper, Settings, Scale } from 'lucide-react';
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
      <header className="h-10 flex items-center px-4 border-b border-border-dim bg-surface shrink-0">
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
      </header>

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto bg-base">
        <div className="max-w-4xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
