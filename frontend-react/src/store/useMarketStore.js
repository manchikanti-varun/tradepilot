import { create } from 'zustand';

export const useMarketStore = create((set, get) => ({
  signals: [],
  riskGate: 'GO',
  riskReason: '',
  marketMode: 'NORMAL',
  vix: null,
  nifty: null,
  bankNifty: null,
  lastScanTime: null,
  scanCountdown: 90,
  isMarketOpen: false,
  marketStatus: null,
  consecutiveLosses: 0,
  todayPnL: 0,
  winRate: 0,
  tradeCount: 0,
  sectors: [],
  movers: { gainers: [], losers: [] },

  setSignals: (signals) => set({ signals }),

  setRiskGate: (gate, reason) => set({ riskGate: gate, riskReason: reason || '' }),

  updateFromState: (state) => {
    const updates = {};
    if (state.market_mode) updates.marketMode = state.market_mode;
    if (state.risk_gate) updates.riskGate = state.risk_gate;
    if (state.risk_reason !== undefined) updates.riskReason = state.risk_reason || '';
    if (state.growth_state) {
      updates.todayPnL = state.growth_state.current_capital || 0;
    }
    set(updates);
  },

  setMarketStatus: (status, countdown) => {
    set({
      marketStatus: status,
      isMarketOpen: status === 'OPEN',
    });
  },

  setSectors: (sectors) => set({ sectors }),
  setMovers: (movers) => set({ movers }),

  setVix: (vix) => set({ vix }),

  setTodayStats: (stats) => set({
    todayPnL: stats.todayPnL ?? get().todayPnL,
    winRate: stats.winRate ?? get().winRate,
    tradeCount: stats.tradeCount ?? get().tradeCount,
    consecutiveLosses: stats.consecutiveLosses ?? get().consecutiveLosses,
  }),

  resetScanCountdown: () => set({ scanCountdown: 90, lastScanTime: new Date().toISOString() }),

  tickScanCountdown: () => set((s) => ({
    scanCountdown: Math.max(0, s.scanCountdown - 1),
  })),
}));
