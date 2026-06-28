import { useState } from 'react';
import { Plus, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { positionApi } from '../../api/position';
import { useAppStore } from '../../store/useAppStore';

export default function IntakeBar() {
  const [intent, setIntent] = useState('BUY');
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="px-4 py-2">
      <div className="bg-surface border border-border-dim rounded-lg p-3 space-y-2.5">
        {/* Row 1: BUY/SELL toggle + Symbol */}
        <div className="flex gap-2">
          {/* Intent Toggle */}
          <div className="flex rounded-md overflow-hidden border border-border-dim">
            <button
              onClick={() => setIntent('BUY')}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors duration-100 ${
                intent === 'BUY'
                  ? 'bg-buy text-white'
                  : 'bg-overlay text-text-muted hover:text-text-secondary'
              }`}
            >
              <ArrowUpRight size={11} /> BUY
            </button>
            <button
              onClick={() => setIntent('SELL')}
              className={`flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold transition-colors duration-100 ${
                intent === 'SELL'
                  ? 'bg-sell text-white'
                  : 'bg-overlay text-text-muted hover:text-text-secondary'
              }`}
            >
              <ArrowDownRight size={11} /> SELL
            </button>
          </div>

          {/* Symbol Input */}
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="SBIN"
            className="flex-1 bg-base border border-border-dim rounded-md px-3 py-1.5 text-xs font-mono text-text-primary uppercase outline-none focus:border-border-mid placeholder:text-text-muted"
          />
        </div>

        {/* Row 2: Price + Qty + Submit */}
        <div className="flex gap-2 items-center">
          {/* Price */}
          <div className="flex-1">
            <label className="text-[8px] uppercase text-text-muted tracking-wider block mb-0.5">Price ₹</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="845.00"
              step="0.05"
              className="w-full bg-base border border-border-dim rounded-md px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-border-mid placeholder:text-text-muted"
            />
          </div>

          {/* Qty with +/- */}
          <div>
            <label className="text-[8px] uppercase text-text-muted tracking-wider block mb-0.5">Qty</label>
            <div className="flex items-center border border-border-dim rounded-md overflow-hidden">
              <button
                onClick={() => adjustQty(-1)}
                className="px-2 py-1.5 bg-overlay hover:bg-base text-text-muted hover:text-text-primary transition-colors duration-100"
              >
                <Minus size={11} />
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                min="1"
                className="w-10 bg-base text-center text-xs font-mono text-text-primary outline-none py-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => adjustQty(1)}
                className="px-2 py-1.5 bg-overlay hover:bg-base text-text-muted hover:text-text-primary transition-colors duration-100"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* Submit */}
          <div>
            <label className="text-[8px] uppercase text-text-muted tracking-wider block mb-0.5">&nbsp;</label>
            <button
              onClick={handleSubmit}
              disabled={!symbol.trim() || !price || !qty || loading}
              className={`px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-100 disabled:opacity-30 disabled:cursor-not-allowed ${
                intent === 'BUY'
                  ? 'bg-buy text-white hover:bg-buy/90'
                  : 'bg-sell text-white hover:bg-sell/90'
              }`}
            >
              {loading ? '...' : intent}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
