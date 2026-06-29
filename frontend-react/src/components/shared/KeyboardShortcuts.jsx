import { Keyboard } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const SHORTCUTS = [
  { key: '1-5', action: 'Open signal plan by position' },
  { key: 'S', action: 'Skip top signal' },
  { key: 'E', action: 'Log manual exit' },
  { key: 'M', action: 'Open morning brief' },
  { key: 'R', action: 'Force refresh' },
  { key: 'Esc', action: 'Close modal' },
  { key: '?', action: 'Toggle shortcuts' },
];

export default function KeyboardShortcuts() {
  const activeModal = useAppStore((s) => s.activeModal);
  const closeModal = useAppStore((s) => s.closeModal);

  if (activeModal !== 'shortcuts') return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center" onClick={closeModal}>
      <div className="bg-elevated border border-border-mid rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-info/12 flex items-center justify-center">
            <Keyboard size={15} className="text-info" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">Keyboard Shortcuts</h3>
        </div>
        <div className="space-y-2.5">
          {SHORTCUTS.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-[11px] text-text-secondary">{action}</span>
              <kbd className="px-2.5 py-1 rounded-lg bg-overlay border border-border-dim text-[11px] font-mono font-semibold text-text-primary">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-5 text-center">Press <kbd className="px-1.5 py-0.5 rounded bg-overlay text-text-secondary font-mono">Esc</kbd> to close</p>
      </div>
    </div>
  );
}
