import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Crosshair, BarChart3, History, Newspaper, Settings } from 'lucide-react';
import DisconnectedBanner from '../components/shared/DisconnectedBanner';
import { useAppStore } from '../store/useAppStore';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/signals', label: 'Signals', icon: Crosshair },
  { path: '/markets', label: 'Markets', icon: BarChart3 },
  { path: '/news', label: 'News', icon: Newspaper },
  { path: '/history', label: 'Trades', icon: History },
  { path: '/settings', label: 'More', icon: Settings },
];

export default function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const connectionStatus = useAppStore((s) => s.connectionStatus);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {connectionStatus === 'disconnected' || connectionStatus === 'reconnecting' ? (
        <DisconnectedBanner />
      ) : null}

      <main className="flex-1 overflow-y-auto bg-base pb-16">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border-dim safe-bottom z-50">
        <div className="flex">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors duration-100 ${
                  active ? 'text-info' : 'text-text-muted'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                <span className="text-[9px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
