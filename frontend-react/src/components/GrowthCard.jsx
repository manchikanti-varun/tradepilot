import { useState } from 'react'

const TIERS = { A: [1000, 2000], B: [2000, 5000], C: [5000, 10000], D: [10000, 20000] }

export default function GrowthCard({ growth, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const range = TIERS[growth.current_tier] || [1000, 2000]

  const handleSave = () => {
    const val = parseFloat(amount)
    if (val >= 1000 && val <= 20000) {
      onUpdate(val)
      setEditing(false)
      setAmount('')
    }
  }

  return (
    <div className="mb-3">
      <div onClick={() => setEditing(!editing)}
        className="bg-gradient-to-br from-blue-950/80 to-dark-700 border border-blue-500/20 rounded-2xl p-5 cursor-pointer hover:border-blue-500/40 transition-all">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">
              ₹{growth.current_capital.toLocaleString('en-IN')}
            </div>
            <div className="inline-block bg-blue-500/15 text-accent-blue px-2.5 py-0.5 rounded-md text-xs font-bold mt-2">
              TIER {growth.current_tier}
            </div>
          </div>
          <div className="text-right text-xs text-gray-400">
            <div>{growth.progress_pct_to_next_tier.toFixed(0)}% to next</div>
            <div className="text-[10px] text-gray-500 mt-1">tap to edit</div>
          </div>
        </div>
        <div className="h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-blue to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${growth.progress_pct_to_next_tier}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
          <span>₹{range[0].toLocaleString()}</span>
          <span>₹{range[1].toLocaleString()}</span>
        </div>
      </div>

      {editing && (
        <div className="bg-dark-700 border border-dark-600 rounded-2xl p-4 mt-2 animate-in">
          <p className="text-xs text-gray-400 mb-2 font-medium">SET CURRENT CAPITAL</p>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="₹1,000 – ₹20,000" min="1000" max="20000" step="100"
            className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white text-lg font-semibold outline-none focus:border-accent-blue mb-3"
          />
          <div className="flex gap-2">
            <button onClick={handleSave}
              className="flex-1 bg-accent-blue text-white py-2.5 rounded-xl font-bold text-sm">
              Save
            </button>
            <button onClick={() => setEditing(false)}
              className="flex-1 bg-dark-600 text-gray-300 py-2.5 rounded-xl font-semibold text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
