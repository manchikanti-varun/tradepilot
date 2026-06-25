const BASE = import.meta.env.VITE_API_URL || '';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const api = {
  health: () => get('/api/health'),
  state: () => get('/api/state'),
  growth: () => get('/api/growth'),
  position: () => get('/api/position'),
  signals: () => get('/api/signals'),
  rejections: () => get('/api/rejections/today'),
  performance: () => get('/api/performance'),
  stats: () => get('/api/stats'),
  brief: () => get('/api/brief/today'),
  news: () => get('/api/news'),
  alerts: () => get('/api/alerts'),
  sectors: () => get('/api/market/sectors'),
  movers: () => get('/api/market/movers'),
  screener: () => get('/api/screener'),
  signalHistory: (limit = 50) => get(`/api/signals/history?limit=${limit}`),
  chart: (symbol, interval = '5m') => get(`/api/chart/${symbol}?interval=${interval}`),
  stockPlan: (symbol) => get(`/api/stock/${symbol}/plan`),
  stockMultiframe: (symbol) => get(`/api/stock/${symbol}/multiframe`),
  livePnl: () => get('/api/position/live-pnl'),
  exitCalc: () => get('/api/position/exit-calc'),
  premarket: () => get('/api/market/premarket'),
  expiry: () => get('/api/market/expiry'),
  countdown: () => get('/api/market/countdown'),
  week52: () => get('/api/market/52week'),
  eodSummary: () => get('/api/eod-summary'),
  insights: () => get('/api/insights'),
  favorites: () => get('/api/favorites'),
  addFavorite: (symbol) => post(`/api/favorites/${symbol}`, {}),
  removeFavorite: (symbol) => fetch(`${BASE}/api/favorites/${symbol}`, { method: 'DELETE' }).then(r => r.json()),
  priceAlerts: () => get('/api/alerts/price'),
  createPriceAlert: (symbol, price, direction) => post('/api/alerts/price', { symbol, target_price: price, direction }),
  deletePriceAlert: (id) => fetch(`${BASE}/api/alerts/price/${id}`, { method: 'DELETE' }).then(r => r.json()),
  quickTrade: (symbol, price, qty, intent) => post(`/api/intake/quick?symbol=${symbol}&price=${price}&qty=${qty}&intent=${intent}`, {}),
  timePerformance: () => get('/api/stats/time-performance'),
  history: (limit = 30) => get(`/api/history?limit=${limit}`),
  exportHistory: () => `${BASE}/api/history/export`,
  tradeNotes: (tradeId) => get(`/api/history/${tradeId}/notes`),
  addTradeNote: (tradeId, note, tags) => post(`/api/history/${tradeId}/notes`, { note, tags }),
  watchlist: () => get('/api/watchlist'),
  realityCheck: () => get('/api/report/reality-check'),
  coachReport: () => get('/api/report/today'),
  intake: (text) => post('/api/intake', { text }),
  confirmIntake: (data) => post('/api/intake/confirm', data),
  setCapital: (capital) => post('/api/capital', { capital }),
  saveSettings: (settings) => post('/api/settings/save', { settings }),
  getSettings: () => get('/api/settings/all'),
  scan: () => post('/api/scan', {}),
};

export function formatTime(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short',
  });
}

export function formatClock() {
  return new Date().toLocaleString('en-IN', {
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });
}

export function formatCurrency(n) {
  if (n === null || n === undefined) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
