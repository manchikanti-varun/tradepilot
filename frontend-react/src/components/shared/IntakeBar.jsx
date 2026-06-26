import { useState } from 'react';
import { Send } from 'lucide-react';
import { positionApi } from '../../api/position';
import { useAppStore } from '../../store/useAppStore';

export default function IntakeBar() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await positionApi.intake(text.trim());
      if (res.status === 'confirm_entry' || res.status === 'confirm_exit') {
        useAppStore.getState().addToast({ type: 'info', message: res.message, duration: 0 });
        // Store parsed data for confirmation
        useAppStore.getState().setActiveModal({ type: 'confirmTrade', data: res });
      } else if (res.status === 'clarification_needed') {
        useAppStore.getState().addToast({ type: 'warning', message: res.message });
      } else {
        useAppStore.getState().addToast({
          type: res.status === 'rejected' ? 'error' : 'success',
          message: res.message,
        });
      }
      setText('');
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="px-4 py-2">
      <div className="flex gap-2 bg-surface border border-border-dim rounded-lg p-1 focus-within:border-border-mid transition-colors duration-100">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Bought SBIN at 845, qty 4..."
          className="flex-1 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className="px-3 py-2 rounded-md bg-buy text-white disabled:opacity-30 transition-opacity duration-100"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
