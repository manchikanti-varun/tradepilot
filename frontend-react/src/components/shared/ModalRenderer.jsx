import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { positionApi } from '../../api/position';
import StockDetailModal from '../StockDetailModal';

export default function ModalRenderer() {
  const activeModal = useAppStore((s) => s.activeModal);
  const closeModal = useAppStore((s) => s.closeModal);

  if (!activeModal) return null;

  if (activeModal.type === 'stockDetail' && activeModal.symbol) {
    return <StockDetailModal symbol={activeModal.symbol} onClose={closeModal} />;
  }

  if (activeModal.type === 'confirmTrade' && activeModal.data) {
    return <ConfirmTradeModal data={activeModal.data} onClose={closeModal} />;
  }

  return null;
}

function ConfirmTradeModal({ data, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await positionApi.confirmIntake(data.parsed);
      useAppStore.getState().addToast({
        type: res.status?.includes('error') ? 'error' : 'success',
        message: res.message,
      });
      onClose();
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[1001] flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-elevated border-t border-border-dim rounded-t-xl p-5"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-text-primary mb-4">{data.message}</p>
        {data.parsed && (
          <div className="bg-surface border border-border-dim rounded-lg p-3 mb-4 text-[11px] space-y-1">
            <div className="flex justify-between"><span className="text-text-muted">Action</span><span className="text-text-primary font-mono">{data.parsed.intent}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Ticker</span><span className="text-text-primary font-mono">{data.parsed.ticker}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Price</span><span className="text-text-primary font-mono">₹{data.parsed.price}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Qty</span><span className="text-text-primary font-mono">{data.parsed.qty}</span></div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-buy text-white text-xs font-medium disabled:opacity-50">
            {loading ? 'Confirming...' : 'Confirm Trade'}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-overlay border border-border-dim text-xs text-text-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
