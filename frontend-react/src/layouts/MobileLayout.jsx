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
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && (
        <DisconnectedBanner />
      )}

      <main className="flex-1 overflow-y-auto bg-base pb-[68px]">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border-dim safe-bottom z-50">
        <div className="flex max-w-lg mx-auto">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-1 transition-all duration-100 ${
                  active ? 'text-info' : 'text-text-muted'
                }`}
              >
                <div className={`relative ${active ? '' : ''}`}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
                  {active && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-info" />
                  )}
                </div>
                <span className={`text-[9px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
