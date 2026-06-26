import { get, post } from './client';

export const positionApi = {
  current: () => get('/api/position'),
  livePnl: () => get('/api/position/live-pnl'),
  exitCalc: () => get('/api/position/exit-calc'),
  intake: (text) => post('/api/intake', { text }),
  confirmIntake: (data) => post('/api/intake/confirm', data),
  quickTrade: (symbol, price, qty, intent) => post(`/api/intake/quick?symbol=${symbol}&price=${price}&qty=${qty}&intent=${intent}`, {}),
};
