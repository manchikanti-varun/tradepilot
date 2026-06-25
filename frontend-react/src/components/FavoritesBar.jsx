import { useState, useEffect } from 'react'
import { Star, Plus } from 'lucide-react'
import { api } from '../api'

export default function FavoritesBar({ onSelectStock }) {
  const [favorites, setFavorites] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [input, setInput] = useState('')

  const fetchFavs = () => api.favorites().then(r => setFavorites(r.favorites || [])).catch(() => {})
  useEffect(() => { fetchFavs() }, [])

  const handleAdd = async () => {
    if (!input) return
    await api.addFavorite(input.toUpperCase())
    setInput(''); setShowAdd(false)
    fetchFavs()
  }

  const handleRemove = async (symbol) => {
    await api.removeFavorite(symbol)
    fetchFavs()
  }

  if (favorites.length === 0 && !showAdd) {
    return (
      <button onClick={() => setShowAdd(true)}
        className="flex items-center gap-1.5 bg-dark-700 border border-dark-600 rounded-xl px-3 py-2 mb-3 text-[10px] text-gray-500 hover:text-gray-300 w-full justify-center">
        <Star size={11} /> Pin your favorite stocks
      </button>
    )
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {favorites.map(f => (
          <button key={f.symbol} onClick={() => onSelectStock?.(f.symbol)}
            onContextMenu={(e) => { e.preventDefault(); handleRemove(f.symbol) }}
            className="flex items-center gap-1 bg-dark-700 border border-dark-600 rounded-lg px-2.5 py-1.5 whitespace-nowrap hover:border-accent-blue/40">
            <Star size={9} className="text-amber-400" />
            <span className="text-[10px] font-bold text-white">{f.symbol}</span>
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center bg-dark-700 border border-dashed border-dark-500 rounded-lg px-2 py-1.5">
          <Plus size={10} className="text-gray-500" />
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-1.5 mt-1.5">
          <input value={input} onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder="SBIN" onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-dark-900 border border-dark-500 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none" />
          <button onClick={handleAdd} className="px-2 py-1.5 bg-accent-blue text-white rounded-lg text-[9px] font-bold">Add</button>
        </div>
      )}
    </div>
  )
}
