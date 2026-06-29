import { useState } from 'react';
import { Pencil, X, Check } from 'lucide-react';
import { usePositionStore } from '../../store/usePositionStore';
import { usePnL } from '../../hooks/usePnL';
import { positionApi } from '../../api/position';
import Card from '../shared/Card';
import MonoNumber from '../shared/MonoNumber';
import Badge from '../shared/Badge';
import PositionProgress from './PositionProgress';
import ExitSignalAlert from './ExitSignalAlert';
import PnLDisplay from './PnLDisplay';
import SectionLabel from '../shared/SectionLabel';
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

  const borderClass = shouldExit ? 'border-sell/50' : flashClass || '';

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
      // Refresh position data from backend so UI updates immediately
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
      <SectionLabel className="mb-2 block">Active Position</SectionLabel>

      <ExitSignalAlert />

      <div className={`bg-surface border border-border-dim rounded-lg p-3 ${borderClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-semibold">{ticker}</span>
            <Badge variant={shouldExit ? 'sell' : phase === 'TRAILING' ? 'buy' : 'neutral'}>
              {phase || 'HOLDING'}
            </Badge>
          </div>
          <button
            onClick={startEdit}
            className="flex items-center gap-1 text-[10px] text-info hover:text-text-primary transition-colors"
          >
            <Pencil size={11} />
            Edit
          </button>
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="space-y-2 mb-3 p-2 bg-overlay rounded border border-border-dim">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-text-muted">Entry Price</label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  step="0.05"
                  className="w-full mt-1 bg-base border border-border-dim rounded px-2 py-1.5 text-sm font-mono text-text-primary outline-none focus:border-info [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase text-text-muted">Quantity</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  min="1"
                  className="w-full mt-1 bg-base border border-border-dim rounded px-2 py-1.5 text-sm font-mono text-text-primary outline-none focus:border-info [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 py-1.5 rounded bg-info/20 border border-info/40 text-[11px] text-info font-medium hover:bg-info/30 flex items-center justify-center gap-1"
              >
                <Check size={12} />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded border border-border-dim text-[11px] text-text-muted hover:text-text-secondary flex items-center gap-1"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Entry / LTP */
          <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
            <div>
              <span className="text-text-muted">Entry</span>
              <MonoNumber value={` ₹${entryPrice?.toFixed(2)}`} className="ml-1" />
            </div>
            <div>
              <span className="text-text-muted">Qty</span>
              <MonoNumber value={` ${qty}`} className="ml-1" />
            </div>
            <div>
              <span className="text-text-muted">LTP</span>
              <MonoNumber value={` ₹${currentLtp?.toFixed(2)}`} className="ml-1" />
              <MonoNumber
                value={` (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%)`}
                color={pctChange >= 0 ? 'buy' : 'sell'}
                className="text-[10px]"
              />
            </div>
            <div>
              <span className="text-text-muted">Time</span>
              <span className="text-text-secondary ml-1 font-mono">{timeInTrade}</span>
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
        <PnLDisplay label="Unrealized P&L" />
        {chargesEstimate && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text-muted">After charges</span>
            <span className="font-mono text-text-secondary">{formatCurrency(chargesEstimate)}</span>
          </div>
        )}

        {/* Manual Exit Button */}
        <button className={`w-full mt-3 py-2 rounded text-xs font-medium border transition-colors duration-100 ${
          shouldExit
            ? 'bg-sell/10 border-sell/40 text-sell hover:bg-sell/20'
            : 'bg-overlay border-border-dim text-text-secondary hover:border-border-mid'
        }`}>
          LOG MANUAL EXIT
        </button>
      </div>
    </div>
  );
}
