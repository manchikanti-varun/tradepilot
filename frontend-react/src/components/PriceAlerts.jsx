import { useState, useEffect } from 'react'
import { Bell, Plus, X, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../api'

export default function PriceAlerts() {
  const [alerts, setAlerts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [symbol, setSymbol] = useState('')
  const [price, setPrice] = useState('')
  const [direction, setDirection] = useState('ABOVE')

  const fetchAlerts = () => api.priceAlerts().then(r => setAlerts(r.alerts || [])).catch(() => {})
  useEffect(() => { fetchAlerts() }, [])

  const handleAdd = async () => {
    if (!symbol || !price) return
    await api.createPriceAlert(symbol.toUpperCase(), parseFloat(price), direction)
    setSymbol(''); setPrice(''); setShowAdd(false)
    fetchAlerts()
  }

  const handleDelete = async (id) => {
    await api.deletePriceAlert(id)
    fetchAlerts()
  }

  return (
    <div className="bg-dark-700 border border-dark-600 rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-accent-blue" />
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Price Alerts</span>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="p-1 rounded-lg bg-dark-600 hover:bg-dark-500">
          <Plus size={12} className="text-gray-400" />
        </button>
      </div>

      {showAdd && (
        <div className="bg-dark-900 rounded-xl p-3 mb-2 space-y-2">
          <div className="flex gap-2">
            <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="SBIN" className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
            <input value={price} onChange={e => setPrice(e.target.value)} type="number"
              placeholder="₹ Price" className="w-24 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDirection('ABOVE')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${direction === 'ABOVE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-dark-700 text-gray-500'}`}>
              ↑ Goes Above
            </button>
            <button onClick={() => setDirection('BELOW')}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold ${direction === 'BELOW' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-dark-700 text-gray-500'}`}>
              ↓ Goes Below
            </button>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-accent-blue text-white rounded-lg text-[10px] font-bold">Set</button>
          </div>
        </div>
      )}

      {alerts.length > 0 ? (
        <div className="space-y-1.5">
          {alerts.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-dark-900 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {a.direction === 'ABOVE' ? <TrendingUp size={10} className="text-green-400" /> : <TrendingDown size={10} className="text-red-400" />}
                <span className="text-xs font-bold text-white">{a.symbol}</span>
                <span className="text-[10px] text-gray-400">{a.direction === 'ABOVE' ? '>' : '<'} ₹{a.target_price}</span>
              </div>
              <button onClick={() => handleDelete(a.id)} className="p-1">
                <X size={10} className="text-gray-600 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-600 text-center py-2">No price alerts set</p>
      )}
    </div>
  )
}
