import { useState, useEffect } from 'react';
import { Star, Plus, X } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { useAppStore } from '../../store/useAppStore';

export default function FavoritesBar() {
  const [favorites, setFavorites] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [input, setInput] = useState('');

  const fetchFavs = () => settingsApi.favorites().then((r) => setFavorites(r.favorites || [])).catch(() => {});
  useEffect(() => { fetchFavs(); }, []);

  const handleAdd = async () => {
    if (!input.trim()) return;
    await settingsApi.addFavorite(input.toUpperCase().trim());
    setInput('');
    setShowAdd(false);
    fetchFavs();
  };

  const handleRemove = async (symbol) => {
    await settingsApi.removeFavorite(symbol);
    fetchFavs();
  };

  if (favorites.length === 0 && !showAdd) {
    return (
      <button onClick={() => setShowAdd(true)}
        className="flex items-center gap-1.5 bg-surface border border-border-dim rounded-lg px-3 py-2 mb-3 text-[10px] text-text-muted hover:text-text-secondary w-full justify-center">
        <Star size={11} /> Pin your favorite stocks
      </button>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {favorites.map((f) => (
          <button key={f.symbol}
            onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: f.symbol })}
            className="flex items-center gap-1 bg-surface border border-border-dim rounded-md px-2 py-1.5 whitespace-nowrap hover:border-border-mid group">
            <Star size={9} className="text-watch" />
            <span className="text-[10px] font-mono font-medium text-text-primary">{f.symbol}</span>
            <button onClick={(e) => { e.stopPropagation(); handleRemove(f.symbol); }}
              className="opacity-0 group-hover:opacity-100 ml-0.5">
              <X size={8} className="text-text-muted hover:text-sell" />
            </button>
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center bg-surface border border-dashed border-border-mid rounded-md px-2 py-1.5">
          <Plus size={10} className="text-text-muted" />
        </button>
      </div>
      {showAdd && (
        <div className="flex gap-1.5 mt-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="SBIN" onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-surface border border-border-dim rounded-md px-2 py-1.5 text-[10px] text-text-primary outline-none placeholder:text-text-muted" />
          <button onClick={handleAdd} className="px-2.5 py-1.5 bg-info text-white rounded-md text-[9px] font-medium">Add</button>
        </div>
      )}
    </div>
  );
}
