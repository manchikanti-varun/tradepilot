import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { useSSE } from './hooks/useSSE';
import { useKeyboard } from './hooks/useKeyboard';
import { usePoll } from './hooks/usePoll';
import { isLoggedIn, getStoredUser } from './api/client';
import { authApi } from './api/auth';
import { marketApi } from './api/market';
import { useMarketStore } from './store/useMarketStore';

import AuthLayout from './layouts/AuthLayout';
import MobileLayout from './layouts/MobileLayout';
import DesktopPageLayout from './layouts/DesktopPageLayout';
import DashboardPage from './pages/DashboardPage';
import SignalsPage from './pages/SignalsPage';
import MarketsPage from './pages/MarketsPage';
import ScreenerPage from './pages/ScreenerPage';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import NewsPage from './pages/NewsPage';
import SettingsPage from './pages/SettingsPage';
import ChartPage from './pages/ChartPage';
import CoachPage from './pages/CoachPage';
import RealityCheckPage from './pages/RealityCheckPage';
import AuthPage from './pages/AuthPage';
import SetupPage from './pages/SetupPage';
import KeyboardShortcuts from './components/shared/KeyboardShortcuts';
import ToastContainer from './components/shared/Toast';
import ModalRenderer from './components/shared/ModalRenderer';
import AskAI from './components/shared/AskAI';

function PrivateRoute({ children }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const needsSetup = useAppStore((s) => s.needsSetup);

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (needsSetup) return <Navigate to="/setup" replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setUser = useAppStore((s) => s.setUser);
  const setNeedsSetup = useAppStore((s) => s.setNeedsSetup);
  const setIsMobile = useAppStore((s) => s.setIsMobile);
  const isMobile = useAppStore((s) => s.isMobile);

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      if (!isLoggedIn()) {
        setAuthenticated(false);
        return;
      }
      try {
        const me = await authApi.me();
        setUser(me.user);
        setAuthenticated(true);
        if (!me.config?.has_groq_key) {
          setNeedsSetup(true);
        } else {
          setNeedsSetup(false);
        }
      } catch {
        setAuthenticated(false);
      }
    }
    checkAuth();

    const handleLogout = () => {
      setAuthenticated(false);
      setUser(null);
      navigate('/auth');
    };
    window.addEventListener('tp_logout', handleLogout);
    return () => window.removeEventListener('tp_logout', handleLogout);
  }, []);

  // Responsive detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  // SSE connection
  useSSE();

  // Market data polling (secondary data)
  usePoll(async () => {
    if (!isAuthenticated) return;
    try {
      const state = await marketApi.state();
      useMarketStore.getState().updateFromState(state);
      const countdown = await marketApi.countdown();
      useMarketStore.getState().setMarketStatus(countdown.status);
    } catch { /* handled by connection banner */ }
  }, 10000, { enabled: isAuthenticated });

  // Keyboard shortcuts
  useKeyboard({
    r: () => { /* Force refresh handled by SSE reconnect */ },
    m: () => useAppStore.getState().setActiveModal('brief'),
  });

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/setup" element={<SetupPage />} />
        </Route>

        {/* Desktop: DashboardPage renders its own 3-panel layout */}
        {!isMobile && (
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        )}

        {/* Mobile routes with bottom nav */}
        {isMobile ? (
          <Route element={<PrivateRoute><MobileLayout /></PrivateRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/chart/:symbol" element={<ChartPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/reality" element={<RealityCheckPage />} />
          </Route>
        ) : (
          <Route element={<PrivateRoute><DesktopPageLayout /></PrivateRoute>}>
            <Route path="/signals" element={<SignalsPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/screener" element={<ScreenerPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/chart/:symbol" element={<ChartPage />} />
            <Route path="/coach" element={<CoachPage />} />
            <Route path="/reality" element={<RealityCheckPage />} />
          </Route>
        )}

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <KeyboardShortcuts />
      <ToastContainer />
      <ModalRenderer />
      <AskAI />
    </>
  );
}
