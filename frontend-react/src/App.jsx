import { useState, useEffect, useCallback } from 'react'
import { api, formatTime12 } from './api'
import Header from './components/Header'
import IntakeBar from './components/IntakeBar'
import GrowthCard from './components/GrowthCard'
import PositionCard from './components/PositionCard'
import SignalCard from './components/SignalCard'
import HistoryList from './components/HistoryList'
import StatsGrid from './components/StatsGrid'
import BriefCard from './components/BriefCard'
import Toast from './components/Toast'

export default function App() {
  const [state, setState] = useState(null)
  const [growth, setGrowth] = useState(null)
  const [position, setPosition] = useState(null)
  const [signals, setSignals] = useState(null)
  const [perf, setPerf] = useState(null)
  const [brief, setBrief] = useState(null)
  const [rejections, setRejections] = useState(null)
  const [tab, setTab] = useState('signals')
  const [toast, setToast] = useState(null)
  const [clock, setClock] = useState(formatTime12())

  const showToast = (msg, type, data) => setToast({ msg, type, data })

  const fetchAll = useCallback(async () => {
    try {
      const [s, g, p, sig, rej, pf] = await Promise.all([
        api.state(), api.growth(), api.position(),
        api.signals(), api.rejections(), api.performance(),
      ])
      setState(s); setGrowth(g); setPosition(p)
      setSignals(sig); setRejections(rej); setPerf(pf)
    } catch (e) { console.error('Fetch failed:', e) }
  }, [])

  useEffect(() => {
    fetchAll()
    api.brief().then(setBrief).catch(() => {})
    const interval = setInterval(fetchAll, 30000)
    const clockInterval = setInterval(() => setClock(formatTime12()), 1000)
    return () => { clearInterval(interval); clearInterval(clockInterval) }
  }, [fetchAll])

  const handleIntake = async (text) => {
    const res = await api.intake(text)
    if (res.status === 'confirm_entry' || res.status === 'confirm_exit') {
      showToast(res.message, 'confirm', res.parsed)
    } else if (res.status === 'clarification_needed') {
      showToast(res.message, 'warn')
    } else {
      showToast(res.message, res.status === 'rejected' ? 'error' : 'info')
    }
  }

  const handleConfirm = async (parsed) => {
    const res = await api.confirmIntake(parsed)
    showToast(res.message, res.status.includes('error') ? 'error' : 'success')
    setToast(null)
    setTimeout(fetchAll, 500)
  }

  const handleCapitalUpdate = async (amount) => {
    const res = await api.setCapital(amount)
    if (res.status === 'updated') {
      showToast(`Capital updated to ₹${amount.toLocaleString()}`, 'success')
      fetchAll()
    }
  }

  return (
    <div className="max-w-md mx-auto px-3 pb-20 min-h-screen">
      <Header clock={clock} state={state} />
      <IntakeBar onSubmit={handleIntake} />

      {/* Risk Banner */}
      {state?.risk_gate === 'HARD_STOP' && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-3 text-sm font-medium">
          🛑 {state.risk_reason}
        </div>
      )}
      {state?.risk_gate === 'CAUTION' && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl mb-3 text-sm font-medium">
          ⚠️ {state.risk_reason}
        </div>
      )}

      {brief && <BriefCard brief={brief} />}
      {growth && <GrowthCard growth={growth} onUpdate={handleCapitalUpdate} />}
      {position?.active && <PositionCard data={position} />}

      {/* Tabs */}
      <div className="flex bg-dark-700 rounded-xl p-1 mb-3 border border-dark-600">
        {['signals', 'history', 'stats'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t ? 'bg-accent-blue text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>
            {t === 'signals' ? '🎯 Signals' : t === 'history' ? '📜 History' : '📊 Stats'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'signals' && (
        <>
          <SignalCard signals={signals} />
          {rejections?.total_rejected > 0 && (
            <div className="bg-amber-500/8 border border-amber-500/20 text-amber-400 px-4 py-2.5 rounded-xl text-xs font-medium mt-2">
              📋 {rejections.headline}
            </div>
          )}
        </>
      )}
      {tab === 'history' && <HistoryList />}
      {tab === 'stats' && <StatsGrid perf={perf} />}

      {toast && <Toast toast={toast} onConfirm={handleConfirm} onDismiss={() => setToast(null)} />}
    </div>
  )
}
