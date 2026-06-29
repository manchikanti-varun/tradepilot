import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Minus, Check, Search, ChevronDown } from 'lucide-react';
import { positionApi } from '../../api/position';
import { marketApi } from '../../api/market';
import { useAppStore } from '../../store/useAppStore';

export default function IntakeBar() {
  const [intent, setIntent] = useState('BUY');
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Symbol search dropdown
  const [stocks, setStocks] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Fetch stock list once
  useEffect(() => {
    marketApi.watchlist()
      .then((data) => setStocks(data.stocks || []))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtered stocks based on search
  const filteredStocks = useMemo(() => {
    if (!searchQuery) return stocks.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return stocks.filter((s) =>
      s.symbol.toLowerCase().includes(q) ||
      s.sector?.toLowerCase().includes(q) ||
      s.symbol.toLowerCase().startsWith(q)
    ).sort((a, b) => {
      // Prioritize stocks that START with the query
      const aStarts = a.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.symbol.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts;
    }).slice(0, 20);
  }, [stocks, searchQuery]);

  const selectSymbol = (sym) => {
    setSymbol(sym);
    // Auto-fill price with LTP
    const stock = stocks.find((s) => s.symbol === sym);
    if (stock?.ltp) {
      setPrice(String(stock.ltp.toFixed(2)));
    }
    setSearchQuery('');
    setSearchOpen(false);
  };

  const handleSubmit = async () => {
    if (!symbol.trim() || !price || !qty) return;
    setLoading(true);
    try {
      const text = `${intent === 'BUY' ? 'Bought' : 'Sold'} ${symbol.toUpperCase()} at ${price}, qty ${qty}`;
      const res = await positionApi.intake(text);
      if (res.status === 'confirm_entry' || res.status === 'confirm_exit') {
        useAppStore.getState().setActiveModal({ type: 'confirmTrade', data: res });
      } else if (res.status === 'clarification_needed') {
        useAppStore.getState().addToast({ type: 'warning', message: res.message });
      } else {
        useAppStore.getState().addToast({
          type: res.status === 'rejected' ? 'error' : 'success',
          message: res.message,
        });
      }
      setSymbol('');
      setPrice('');
      setQty('1');
      setExpanded(false);
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  const adjustQty = (delta) => {
    const current = parseInt(qty) || 0;
    const next = Math.max(1, current + delta);
    setQty(String(next));
  };

  // Collapsed: just show a button to expand
  if (!expanded) {
    return (
      <div className="px-4 py-2">
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2.5 rounded-lg border border-border-dim bg-surface text-xs text-text-secondary hover:border-border-mid hover:text-text-primary transition-colors duration-100"
        >
          + Log a Trade
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <div className="bg-surface border border-border-dim rounded-lg p-4 space-y-4">
        {/* BUY / SELL - Large toggle */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIntent('BUY')}
            className={`py-3 rounded-lg text-sm font-bold transition-all duration-100 ${
              intent === 'BUY'
                ? 'bg-buy text-white shadow-sm shadow-buy/20'
                : 'bg-overlay border border-border-dim text-text-muted hover:text-text-secondary'
            }`}
          >
            ↑ BUY
          </button>
          <button
            onClick={() => setIntent('SELL')}
            className={`py-3 rounded-lg text-sm font-bold transition-all duration-100 ${
              intent === 'SELL'
                ? 'bg-sell text-white shadow-sm shadow-sell/20'
                : 'bg-overlay border border-border-dim text-text-muted hover:text-text-secondary'
            }`}
          >
            ↓ SELL
          </button>
        </div>

        {/* Symbol — searchable dropdown */}
        <div ref={dropdownRef} className="relative">
          <label className="text-[9px] uppercase text-text-muted tracking-wider block mb-1">Stock Symbol</label>
          <div
            className={`flex items-center bg-base border rounded-lg px-3 py-3 cursor-pointer transition-colors duration-100 ${
              searchOpen ? 'border-info/50 ring-1 ring-info/20' : 'border-border-dim'
            }`}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={14} className="text-text-muted mr-2 shrink-0" />
            {searchOpen ? (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type stock name... (e.g. POWER, AXIS, RELIANCE)"
                autoFocus
                className="flex-1 bg-transparent text-sm font-mono text-text-primary outline-none placeholder:text-text-muted"
              />
            ) : (
              <span className={`flex-1 text-sm font-mono ${symbol ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>
                {symbol || 'Search stock...'}
              </span>
            )}
            {symbol && !searchOpen && (
              <button
                onClick={(e) => { e.stopPropagation(); setSymbol(''); setPrice(''); }}
                className="text-text-muted hover:text-text-primary ml-2 text-xs"
              >
                ✕
              </button>
            )}
            <ChevronDown size={13} className={`text-text-muted transition-transform duration-100 ml-1 ${searchOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Dropdown */}
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-elevated border border-border-mid rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
              {/* Section header */}
              <div className="px-3 py-1.5 bg-overlay border-b border-border-dim sticky top-0">
                <span className="text-[9px] uppercase text-text-muted tracking-wider">
                  {searchQuery ? `Results for "${searchQuery}"` : 'Popular Stocks'}
                </span>
              </div>
              {filteredStocks.length > 0 ? (
                filteredStocks.map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => selectSymbol(s.symbol)}
                    className="w-full flex items-center justify-between px-3 py-3 hover:bg-info/5 text-left transition-colors duration-75 border-b border-border-dim/50 last:border-0"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-mono font-semibold text-text-primary">{s.symbol}</span>
                      <span className="text-[10px] text-text-muted mt-0.5">{s.sector}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-text-primary">₹{s.ltp?.toFixed(2)}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-[11px] text-text-muted">
                  No stocks found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Price + Qty side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Price */}
          <div>
            <label className="text-[9px] uppercase text-text-muted tracking-wider block mb-1">Price ₹</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="845.00"
              step="0.05"
              className="w-full bg-base border border-border-dim rounded-lg px-4 py-3 text-sm font-mono text-text-primary outline-none focus:border-border-mid placeholder:text-text-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Qty */}
          <div>
            <label className="text-[9px] uppercase text-text-muted tracking-wider block mb-1">Quantity</label>
            <div className="flex items-center border border-border-dim rounded-lg overflow-hidden bg-base">
              <button
                onClick={() => adjustQty(-1)}
                className="px-3 py-3 bg-overlay hover:bg-base text-text-muted hover:text-text-primary transition-colors duration-100 border-r border-border-dim"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min="1"
                className="flex-1 bg-base text-center text-sm font-mono text-text-primary outline-none py-3 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => adjustQty(1)}
                className="px-3 py-3 bg-overlay hover:bg-base text-text-muted hover:text-text-primary transition-colors duration-100 border-l border-border-dim"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Submit + Cancel */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!symbol.trim() || !price || !qty || loading}
            className={`flex-1 py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed ${
              intent === 'BUY'
                ? 'bg-buy text-white hover:bg-buy/90'
                : 'bg-sell text-white hover:bg-sell/90'
            }`}
          >
            <Check size={14} />
            {loading ? 'Submitting...' : `Confirm ${intent}`}
          </button>
          <button
            onClick={() => { setExpanded(false); setSymbol(''); setPrice(''); setQty('1'); }}
            className="px-4 py-3 rounded-lg border border-border-dim text-xs text-text-muted hover:text-text-secondary transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
