import { useState, useEffect, useCallback, useRef } from 'react'
import { api, auth, formatClock, isLoggedIn, getStoredUser, clearTokens, setStoredUser } from './api'
import { LayoutDashboard, Radio, History, Newspaper, Settings, BarChart3 } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import WatchlistPage from './pages/WatchlistPage'
import ScreenerPage from './pages/ScreenerPage'
import HistoryPage from './pages/HistoryPage'
import NewsPage from './pages/NewsPage'
import StatsPage from './pages/StatsPage'
import RealityCheckPage from './pages/RealityCheckPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import SetupPage from './pages/SetupPage'
import Toast from './components/Toast'
import NotificationBanner from './components/NotificationBanner'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'watchlist', label: 'Scan', icon: Radio },
  { id: 'screener', label: 'Screener', icon: BarChart3 },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'history', label: 'Trades', icon: History },
  { id: 'settings', label: 'More', icon: Settings },
]

let notifIdCounter = 0
function makeNotifId() { return ++notifIdCounter }

function formatNow() {
  return new Date().toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function App() {
  // Auth state
  const [user, setUser] = useState(getStoredUser())
  const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn())
  const [needsSetup, setNeedsSetup] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // App state
  const [page, setPage] = useState('dashboard')
  const [state, setState] = useState(null)
  const [growth, setGrowth] = useState(null)
  const [position, setPosition] = useState(null)
  const [signals, setSignals] = useState(null)
  const [perf, setPerf] = useState(null)
  const [brief, setBrief] = useState(null)
  const [rejections, setRejections] = useState(null)
  const [toast, setToast] = useState(null)
  const [clock, setClock] = useState(formatClock())
  const [notifications, setNotifications] = useState([])

  // Track previous state for change detection
  const prevSignals = useRef(null)
  const prevExitSignal = useRef(null)
  const prevRiskGate = useRef(null)
  const prevPosition = useRef(null)

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      if (!isLoggedIn()) {
        setIsAuthenticated(false)
        setCheckingAuth(false)
        return
      }
      try {
        const me = await auth.me()
        setUser(me.user)
        setStoredUser(me.user)
        setIsAuthenticated(true)
        // Check if Groq key is configured
        if (!me.config?.has_groq_key) {
          setNeedsSetup(true)
        }
      } catch {
        clearTokens()
        setIsAuthenticated(false)
      }
      setCheckingAuth(false)
    }
    checkAuth()

    // Listen for forced logout
    const handleLogout = () => {
      setIsAuthenticated(false)
      setUser(null)
    }
    window.addEventListener('tp_logout', handleLogout)
    return () => window.removeEventListener('tp_logout', handleLogout)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
    setNeedsSetup(true) // Check credentials after login
  }

  const handleLogout = () => {
    clearTokens()
    setIsAuthenticated(false)
    setUser(null)
    setNeedsSetup(false)
  }

  const handleSetupComplete = () => {
    setNeedsSetup(false)
  }

  // --- App logic (same as before) ---

  const addNotification = useCallback((type, title, detail) => {
    const notif = { id: makeNotifId(), type, title, detail, time: formatNow() }
    setNotifications(prev => [notif, ...prev].slice(0, 10))
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = type === 'signal' ? 800 : type === 'exit' ? 400 : 600
      gain.gain.value = 0.1
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch (e) { /* audio not available */ }
  }, [])

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const dismissAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const showToast = (msg, type, data) => {
    setToast({ msg, type, data })
    if (type !== 'confirm') setTimeout(() => setToast(null), 4000)
  }

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated || needsSetup) return
    try {
      const [s, g, p, sig, rej, pf] = await Promise.all([
        api.state(), api.growth(), api.position(),
        api.signals(), api.rejections(), api.performance(),
      ])

      // Detect changes and fire notifications
      if (sig?.signals?.length > 0 && prevSignals.current !== null) {
        const prevCount = prevSignals.current?.signals?.length || 0
        if (sig.signals.length > prevCount || (sig.signals.length > 0 && prevCount === 0)) {
          const s1 = sig.signals[0]
          addNotification('signal',
            `BUY ${s1.symbol} @ ₹${s1.ltp.toFixed(0)} — Grade ${s1.grade}`,
            `Qty ${s1.qty} | Stop ₹${s1.stop_price.toFixed(0)} | Target ₹${s1.target.toFixed(0)}`
          )
        }
      }
      if (p?.exit_signal?.should_exit && !prevExitSignal.current?.should_exit) {
        addNotification('exit', `EXIT ${p.position?.ticker} — ${p.exit_signal.urgency}`, p.exit_signal.reason)
      }
      if (s?.risk_gate && prevRiskGate.current && s.risk_gate !== prevRiskGate.current) {
        if (s.risk_gate === 'HARD_STOP') addNotification('risk', 'HARD STOP — Trading halted', s.risk_reason)
        else if (s.risk_gate === 'CAUTION') addNotification('risk', 'CAUTION — Size reduced', s.risk_reason)
      }
      if (p?.active && !prevPosition.current?.active) {
        addNotification('signal', `Position opened: ${p.position.ticker}`,
          `Qty ${p.position.qty} @ ₹${p.position.entry_price.toFixed(0)}`)
      }

      prevSignals.current = sig
      prevExitSignal.current = p?.exit_signal
      prevRiskGate.current = s?.risk_gate
      prevPosition.current = p

      setState(s); setGrowth(g); setPosition(p)
      setSignals(sig); setRejections(rej); setPerf(pf)
    } catch (e) { console.error(e) }
  }, [isAuthenticated, needsSetup, addNotification])

  useEffect(() => {
    if (!isAuthenticated || needsSetup) return
    fetchAll()
    api.brief().then(setBrief).catch(() => {})
    const t1 = setInterval(fetchAll, 30000)
    const t2 = setInterval(() => setClock(formatClock()), 1000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchAll, isAuthenticated, needsSetup])

  const handleIntake = async (text) => {
    const res = await api.intake(text)
    if (res.status === 'confirm_entry' || res.status === 'confirm_exit')
      showToast(res.message, 'confirm', res.parsed)
    else if (res.status === 'clarification_needed')
      showToast(res.message, 'warn')
    else showToast(res.message, res.status === 'rejected' ? 'error' : 'info')
  }

  const handleConfirm = async (parsed) => {
    const res = await api.confirmIntake(parsed)
    showToast(res.message, res.status.includes('error') ? 'error' : 'success')
    setToast(null)
    setTimeout(fetchAll, 500)
  }

  const handleCapitalUpdate = async (amount) => {
    try {
      const res = await api.setCapital(amount)
      if (res.status === 'updated') { showToast(`Capital set to ₹${amount.toLocaleString()}`, 'success'); fetchAll() }
      else showToast('Failed to update', 'error')
    } catch { showToast('Network error', 'error') }
  }

  // --- Render ---

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  // Not logged in → show auth page
  if (!isAuthenticated) {
    return <AuthPage onLogin={handleLogin} />
  }

  // Logged in but needs API key setup
  if (needsSetup) {
    return <SetupPage onComplete={handleSetupComplete} />
  }

  // Main app
  const ctx = { state, growth, position, signals, perf, brief, rejections, clock, handleIntake, handleCapitalUpdate, fetchAll, user, onLogout: handleLogout }

  return (
    <div className="flex flex-col h-screen bg-dark-900">
      <NotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
        onDismissAll={dismissAllNotifications}
      />

      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 pt-2">
          {page === 'dashboard' && <Dashboard {...ctx} />}
          {page === 'watchlist' && <WatchlistPage />}
          {page === 'screener' && <ScreenerPage />}
          {page === 'news' && <NewsPage />}
          {page === 'stats' && <StatsPage onNavigate={setPage} />}
          {page === 'reality' && <RealityCheckPage />}
          {page === 'history' && <HistoryPage />}
          {page === 'settings' && <SettingsPage growth={growth} onCapitalUpdate={handleCapitalUpdate} user={user} onLogout={handleLogout} />}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-md border-t border-dark-600 safe-bottom">
        <div className="max-w-lg mx-auto flex">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
                page === id ? 'text-accent-blue' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <Icon size={20} strokeWidth={page === id ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {toast && <Toast toast={toast} onConfirm={handleConfirm} onDismiss={() => setToast(null)} />}
    </div>
  )
}
