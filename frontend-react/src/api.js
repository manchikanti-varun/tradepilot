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
  brief: () => get('/api/brief/today'),
  news: () => get('/api/news'),
  alerts: () => get('/api/alerts'),
  history: (limit = 30) => get(`/api/history?limit=${limit}`),
  watchlist: () => get('/api/watchlist'),
  realityCheck: () => get('/api/report/reality-check'),
  coachReport: () => get('/api/report/today'),
  intake: (text) => post('/api/intake', { text }),
  confirmIntake: (data) => post('/api/intake/confirm', data),
  setCapital: (capital) => post('/api/capital', { capital }),
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
