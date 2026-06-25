import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, Radio } from 'lucide-react'
import { api } from '../api'

export default function MarketStatus() {
  const [countdown, setCountdown] = useState(null)
  const [expiry, setExpiry] = useState(null)

  useEffect(() => {
    const fetch = () => {
      api.countdown().then(setCountdown).catch(() => {})
      api.expiry().then(setExpiry).catch(() => {})
    }
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [])

  if (!countdown) return null

  return (
    <div className="flex items-center justify-between bg-dark-800 border border-dark-600 rounded-xl px-3 py-2 mb-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          countdown.status === 'OPEN' ? 'bg-green-400 animate-pulse' :
          countdown.status === 'PRE_MARKET' ? 'bg-amber-400 animate-pulse' : 'bg-gray-600'
        }`} />
        <span className={`text-[11px] font-bold ${
          countdown.status === 'OPEN' ? 'text-green-400' :
          countdown.status === 'PRE_MARKET' ? 'text-amber-400' : 'text-gray-500'
        }`}>
          {countdown.status === 'OPEN' ? 'MARKET OPEN' :
           countdown.status === 'PRE_MARKET' ? 'PRE-MARKET' : 'MARKET CLOSED'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">{countdown.display}</span>
      </div>
      {expiry?.is_expiry_day && (
        <div className="flex items-center gap-1 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
          <AlertTriangle size={9} className="text-amber-400" />
          <span className="text-[9px] text-amber-400 font-bold">EXPIRY</span>
        </div>
      )}
    </div>
  )
}
