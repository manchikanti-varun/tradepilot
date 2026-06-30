import { create } from 'zustand';

export const usePositionStore = create((set) => ({
  active: false,
  ticker: null,
  entryPrice: null,
  currentLtp: null,
  qty: null,
  stopPrice: null,
  target: null,
  entryTime: null,
  phase: null,
  shouldExit: false,
  exitUrgency: '',
  exitReason: '',
  unrealizedPnL: null,
  chargesEstimate: null,
  grossPnL: null,
  peakPrice: null,
  tradeId: null,

  updateFromApi: (data) => {
    if (!data || !data.active) {
      set({
        active: false,
        ticker: null,
        entryPrice: null,
        currentLtp: null,
        qty: null,
        stopPrice: null,
        target: null,
        entryTime: null,
        phase: null,
        shouldExit: false,
        exitUrgency: '',
        exitReason: '',
        unrealizedPnL: null,
        chargesEstimate: null,
        grossPnL: null,
        peakPrice: null,
        tradeId: null,
      });
      return;
    }

    const p = data.position;
    const exit = data.exit_signal;

    set({
      active: true,
      ticker: p.ticker,
      entryPrice: p.entry_price,
      currentLtp: p.current_ltp,
      qty: p.qty,
      stopPrice: p.stop_price,
      target: p.target ?? p.peak_price,
      entryTime: p.entry_time,
      phase: p.phase,
      shouldExit: exit?.should_exit || false,
      exitUrgency: exit?.urgency || '',
      exitReason: exit?.reason || '',
      unrealizedPnL: p.net_pnl,
      chargesEstimate: p.charges_estimate,
      grossPnL: p.gross_pnl,
      peakPrice: p.peak_price,
      tradeId: p.trade_id,
    });
  },

  setExitSignal: (signal) => {
    set({
      shouldExit: signal?.should_exit || false,
      exitUrgency: signal?.urgency || '',
      exitReason: signal?.reason || '',
    });
  },
}));
