import { useAppStore } from '../../store/useAppStore';

const SHORTCUTS = [
  { key: '1-5', action: 'Open signal plan by position' },
  { key: 'S', action: 'Skip top signal' },
  { key: 'E', action: 'Log manual exit for active position' },
  { key: 'M', action: 'Open morning brief' },
  { key: 'R', action: 'Force refresh all data' },
  { key: 'Esc', action: 'Close any open modal' },
  { key: '?', action: 'Show/hide this overlay' },
];

export default function KeyboardShortcuts() {
  const activeModal = useAppStore((s) => s.activeModal);
  const closeModal = useAppStore((s) => s.closeModal);

  if (activeModal !== 'shortcuts') return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center" onClick={closeModal}>
      <div className="bg-elevated border border-border-dim rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium text-text-primary mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{action}</span>
              <kbd className="px-2 py-0.5 rounded bg-overlay border border-border-dim text-[11px] font-mono text-text-primary">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-muted mt-4 text-center">Press Esc or ? to close</p>
      </div>
    </div>
  );
}
