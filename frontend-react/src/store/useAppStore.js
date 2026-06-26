import { create } from 'zustand';

let notifId = 0;

export const useAppStore = create((set, get) => ({
  isAuthenticated: false,
  needsSetup: false,
  user: null,
  notifications: [],
  toasts: [],
  activeModal: null,
  isMobile: window.innerWidth < 768,
  connectionStatus: 'connecting', // 'connected' | 'polling' | 'reconnecting' | 'disconnected'
  lastUpdated: null,

  setAuthenticated: (val) => set({ isAuthenticated: val }),
  setNeedsSetup: (val) => set({ needsSetup: val }),
  setUser: (user) => set({ user }),

  setConnectionStatus: (status) => set({
    connectionStatus: status,
    lastUpdated: status === 'connected' || status === 'polling' ? new Date().toISOString() : get().lastUpdated,
  }),

  setIsMobile: (val) => set({ isMobile: val }),

  addNotification: ({ type, title, detail }) => {
    const notification = {
      id: ++notifId,
      type,
      title,
      detail,
      time: new Date().toISOString(),
      read: false,
    };
    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 20),
    }));
  },

  dismissNotification: (id) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => set({ notifications: [] }),

  addToast: ({ type, message, duration = 4000 }) => {
    const id = ++notifId;
    set((s) => ({
      toasts: [...s.toasts, { id, type, message }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    return id;
  },

  removeToast: (id) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }));
  },

  setActiveModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
}));
