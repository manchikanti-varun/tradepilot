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
        className="flex items-center gap-2 bg-overlay border border-dashed border-border-mid rounded-xl px-4 py-2.5 mb-3 text-[11px] text-text-muted hover:text-info hover:border-info/30 w-full justify-center transition-all">
        <Star size={12} /> Pin your favorite stocks
      </button>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {favorites.map((f) => (
          <button key={f.symbol}
            onClick={() => useAppStore.getState().setActiveModal({ type: 'stockDetail', symbol: f.symbol })}
            className="flex items-center gap-1.5 bg-surface border border-border-dim rounded-lg px-2.5 py-2 whitespace-nowrap hover:border-info/30 group transition-all">
            <Star size={10} className="text-watch" />
            <span className="text-[10px] font-mono font-semibold text-text-primary">{f.symbol}</span>
            <button onClick={(e) => { e.stopPropagation(); handleRemove(f.symbol); }}
              className="opacity-0 group-hover:opacity-100 ml-0.5 transition-opacity">
              <X size={9} className="text-text-muted hover:text-sell" />
            </button>
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center bg-overlay border border-dashed border-border-mid rounded-lg px-2.5 py-2 hover:border-info/30 transition-all">
          <Plus size={11} className="text-text-muted" />
        </button>
      </div>
      {showAdd && (
        <div className="flex gap-2 mt-2 animate-slide-in">
          <input value={input} onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="e.g. SBIN" onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="flex-1 bg-base border border-border-dim rounded-lg px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-info placeholder:text-text-muted" />
          <button onClick={handleAdd} className="px-3 py-2 bg-info text-white rounded-lg text-[10px] font-semibold hover:bg-info/90 transition-colors">Add</button>
        </div>
      )}
    </div>
  );
}
