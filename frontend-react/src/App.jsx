import { useState, useEffect, useCallback } from 'react'
import { api, formatClock } from './api'
import { LayoutDashboard, Radio, BarChart3, History, Settings, Wallet } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import WatchlistPage from './pages/WatchlistPage'
import HistoryPage from './pages/HistoryPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import Toast from './components/Toast'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'watchlist', label: 'Watchlist', icon: Radio },
  { id: 'history', label: 'Trades', icon: History },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function App() {
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

  const showToast = (msg, type, data) => {
    setToast({ msg, type, data })
    if (type !== 'confirm') setTimeout(() => setToast(null), 4000)
  }

  const fetchAll = useCallback(async () => {
    try {
      const [s, g, p, sig, rej, pf] = await Promise.all([
        api.state(), api.growth(), api.position(),
        api.signals(), api.rejections(), api.performance(),
      ])
      setState(s); setGrowth(g); setPosition(p)
      setSignals(sig); setRejections(rej); setPerf(pf)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    fetchAll()
    api.brief().then(setBrief).catch(() => {})
    const t1 = setInterval(fetchAll, 30000)
    const t2 = setInterval(() => setClock(formatClock()), 1000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [fetchAll])

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

  const ctx = { state, growth, position, signals, perf, brief, rejections, clock, handleIntake, handleCapitalUpdate, fetchAll }

  return (
    <div className="flex flex-col h-screen bg-dark-900">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-lg mx-auto px-4 pt-2">
          {page === 'dashboard' && <Dashboard {...ctx} />}
          {page === 'watchlist' && <WatchlistPage />}
          {page === 'history' && <HistoryPage />}
          {page === 'stats' && <StatsPage perf={perf} />}
          {page === 'settings' && <SettingsPage growth={growth} onCapitalUpdate={handleCapitalUpdate} />}
        </div>
      </div>

      {/* Bottom Nav */}
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
