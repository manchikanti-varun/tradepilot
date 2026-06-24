import { useState } from 'react'
import { Settings, Wallet, Shield, Info, ExternalLink } from 'lucide-react'
import { formatCurrency } from '../api'

const TIER_INFO = {
  A: { range: '₹1,000 – ₹2,000', risk: '2%', proven_risk: '8%' },
  B: { range: '₹2,000 – ₹5,000', risk: '3%', proven_risk: '10%' },
  C: { range: '₹5,000 – ₹10,000', risk: '4%', proven_risk: '12%' },
  D: { range: '₹10,000 – ₹20,000', risk: '5%', proven_risk: '15%' },
}

export default function SettingsPage({ growth, onCapitalUpdate }) {
  const [amount, setAmount] = useState('')
  const [showTiers, setShowTiers] = useState(false)

  const handleSave = () => {
    const val = parseFloat(amount)
    if (val >= 1000 && val <= 20000) { onCapitalUpdate(val); setAmount('') }
  }

  const tier = growth?.current_tier || 'A'
  const tierInfo = TIER_INFO[tier]

  return (
    <div className="py-3">
      <div className="mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Settings size={18} className="text-accent-blue" /> Settings
        </h2>
      </div>

      {/* Capital Section */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-5 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-accent-blue" />
          <span className="text-sm font-bold">Trading Capital</span>
        </div>
        <div className="text-2xl font-extrabold mb-1">
          {growth ? formatCurrency(growth.current_capital) : '—'}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Current tier: <span className="text-accent-blue font-semibold">Tier {tier}</span> ({tierInfo.range})
        </p>

        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="New capital (₹1,000 – ₹20,000)" min="1000" max="20000" step="100"
          className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white font-semibold outline-none focus:border-accent-blue transition-colors mb-3"
        />
        <button onClick={handleSave} disabled={!amount || parseFloat(amount) < 1000}
          className="w-full bg-accent-blue text-white py-3 rounded-xl font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
          Update Capital
        </button>
      </div>

      {/* Tier Info */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-5 mb-3">
        <button onClick={() => setShowTiers(!showTiers)}
          className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-amber-400" />
            <span className="text-sm font-bold">Risk & Tier Levels</span>
          </div>
          <span className="text-xs text-gray-500">{showTiers ? 'Hide' : 'Show'}</span>
        </button>

        {showTiers && (
          <div className="mt-4 space-y-2">
            {Object.entries(TIER_INFO).map(([t, info]) => (
              <div key={t} className={`flex justify-between items-center px-3 py-2.5 rounded-lg ${
                t === tier ? 'bg-accent-blue/10 border border-accent-blue/30' : 'bg-dark-900'
              }`}>
                <div>
                  <span className="font-bold text-sm">Tier {t}</span>
                  <span className="text-[10px] text-gray-500 ml-2">{info.range}</span>
                </div>
                <div className="text-right text-xs">
                  <div className="text-gray-400">Risk: <span className="text-white font-semibold">{info.risk}</span></div>
                  <div className="text-gray-500">Proven: {info.proven_risk}</div>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-600 mt-2 px-1">
              Proven risk levels unlock after Engine 24 validates 50+ trades beating Nifty.
            </p>
          </div>
        )}
      </div>

      {/* About */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} className="text-gray-400" />
          <span className="text-sm font-bold">About</span>
        </div>
        <div className="space-y-2 text-xs text-gray-400">
          <p><span className="text-gray-300 font-medium">TradePilot AI v3.4</span> — Personal trading co-pilot</p>
          <p>Zero broker integration. You execute every trade manually.</p>
          <p>Charge model: Angel One intraday equity slabs.</p>
          <p>Data: Yahoo Finance (free, no API key).</p>
        </div>
      </div>
    </div>
  )
}
