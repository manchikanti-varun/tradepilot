import { useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useKeyboard(shortcuts = {}) {
  const handleKeyDown = useCallback((e) => {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    const key = e.key.toLowerCase();

    if (key === '?' || (e.shiftKey && key === '/')) {
      e.preventDefault();
      const modal = useAppStore.getState().activeModal;
      if (modal === 'shortcuts') {
        useAppStore.getState().closeModal();
      } else {
        useAppStore.getState().setActiveModal('shortcuts');
      }
      return;
    }

    if (key === 'escape') {
      e.preventDefault();
      useAppStore.getState().closeModal();
      return;
    }

    const handler = shortcuts[key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
