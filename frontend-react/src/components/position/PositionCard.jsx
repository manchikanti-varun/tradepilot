import { useState } from 'react';
import { Pencil, X, Check, Clock, LogOut, TrendingUp, TrendingDown } from 'lucide-react';
import { usePositionStore } from '../../store/usePositionStore';
import { usePnL } from '../../hooks/usePnL';
import { positionApi } from '../../api/position';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import PositionProgress from './PositionProgress';
import ExitSignalAlert from './ExitSignalAlert';
import PnLDisplay from './PnLDisplay';
import { formatCurrency } from '../../api/client';
import { useAppStore } from '../../store/useAppStore';

export default function PositionCard() {
  const active = usePositionStore((s) => s.active);
  const ticker = usePositionStore((s) => s.ticker);
  const entryPrice = usePositionStore((s) => s.entryPrice);
  const currentLtp = usePositionStore((s) => s.currentLtp);
  const qty = usePositionStore((s) => s.qty);
  const stopPrice = usePositionStore((s) => s.stopPrice);
  const target = usePositionStore((s) => s.target);
  const entryTime = usePositionStore((s) => s.entryTime);
  const phase = usePositionStore((s) => s.phase);
  const shouldExit = usePositionStore((s) => s.shouldExit);
  const chargesEstimate = usePositionStore((s) => s.chargesEstimate);
  const { flashClass } = usePnL();

  const [editing, setEditing] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState('');
  const [saving, setSaving] = useState(false);

  if (!active) return null;

  const timeInTrade = entryTime
    ? `${Math.round((Date.now() - new Date(entryTime).getTime()) / 60000)} min`
    : '—';

  const pctChange = entryPrice && currentLtp
    ? ((currentLtp - entryPrice) / entryPrice * 100)
    : 0;

  const isProfit = pctChange >= 0;
  const borderAccent = shouldExit ? 'border-l-4 border-l-sell' : isProfit ? 'border-l-4 border-l-buy' : 'border-l-4 border-l-sell';

  const startEdit = () => {
    setEditPrice(entryPrice?.toFixed(2) || '');
    setEditQty(String(qty || ''));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editPrice || !editQty) return;
    setSaving(true);
    try {
      await positionApi.editEntry(parseFloat(editPrice), parseInt(editQty));
      const posData = await positionApi.current();
      usePositionStore.getState().updateFromApi(posData);
      useAppStore.getState().addToast({ type: 'success', message: 'Position updated' });
      setEditing(false);
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message || 'Failed to update' });
    }
    setSaving(false);
  };

  return (
    <div className="px-4 py-3">
      <ExitSignalAlert />

      <div className={`bg-surface border border-border-dim rounded-xl p-4 ${borderAccent} ${flashClass || ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isProfit ? 'bg-buy/12' : 'bg-sell/12'}`}>
              {isProfit ? <TrendingUp size={16} className="text-buy" /> : <TrendingDown size={16} className="text-sell" />}
            </div>
            <div>
              <span className="font-mono text-lg font-bold text-text-primary">{ticker}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={shouldExit ? 'sell' : phase === 'TRAILING' ? 'buy' : 'neutral'}>
                  {phase || 'HOLDING'}
                </Badge>
                <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                  <Clock size={9} /> {timeInTrade}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={startEdit}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-text-muted hover:text-info hover:bg-info/5 transition-all"
          >
            <Pencil size={10} />
            Edit
          </button>
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="space-y-3 mb-3 p-3 bg-overlay rounded-lg border border-border-dim animate-slide-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-text-muted font-medium block mb-1">Entry Price</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  step="0.05"
                  className="w-full bg-base border border-border-dim rounded-lg px-3 py-2 text-sm font-mono text-text-primary outline-none focus:border-info focus:ring-1 focus:ring-info/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-text-muted font-medium block mb-1">Quantity</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  min="1"
                  className="w-full bg-base border border-border-dim rounded-lg px-3 py-2 text-sm font-mono text-text-primary outline-none focus:border-info focus:ring-1 focus:ring-info/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-info/15 border border-info/30 text-xs text-info font-semibold hover:bg-info/25 flex items-center justify-center gap-1.5 transition-all"
              >
                <Check size={13} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg border border-border-dim text-xs text-text-muted hover:text-text-secondary hover:border-border-mid flex items-center gap-1 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ) : (
          /* Position Data Grid */
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-overlay rounded-lg p-2.5">
              <span className="text-[10px] text-text-muted block">Entry</span>
              <span className="text-sm font-mono font-semibold text-text-primary">₹{entryPrice?.toFixed(2)}</span>
            </div>
            <div className="bg-overlay rounded-lg p-2.5">
              <span className="text-[10px] text-text-muted block">LTP</span>
              <span className="text-sm font-mono font-semibold text-text-primary">₹{currentLtp?.toFixed(2)}</span>
            </div>
            <div className="bg-overlay rounded-lg p-2.5">
              <span className="text-[10px] text-text-muted block">Qty</span>
              <span className="text-sm font-mono font-semibold text-text-primary">{qty}</span>
            </div>
            <div className="bg-overlay rounded-lg p-2.5">
              <span className="text-[10px] text-text-muted block">P&L %</span>
              <span className={`text-sm font-mono font-bold ${isProfit ? 'text-buy' : 'text-sell'}`}>
                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <PositionProgress
          entryPrice={entryPrice}
          currentLtp={currentLtp}
          stopPrice={stopPrice}
          targetPrice={target}
        />

        {/* P&L */}
        <div className="mt-3 pt-3 border-t border-border-dim">
          <PnLDisplay label="Unrealized P&L" />
          {chargesEstimate && (
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-text-muted">Est. charges</span>
              <span className="font-mono text-text-secondary">{formatCurrency(chargesEstimate)}</span>
            </div>
          )}
        </div>

        {/* Manual Exit Button */}
        <button className={`w-full mt-4 py-2.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
          shouldExit
            ? 'bg-sell/10 border-sell/30 text-sell hover:bg-sell/20'
            : 'bg-overlay border-border-dim text-text-secondary hover:border-border-mid hover:text-text-primary'
        }`}>
          <LogOut size={13} />
          LOG MANUAL EXIT
        </button>
      </div>
    </div>
  );
}
