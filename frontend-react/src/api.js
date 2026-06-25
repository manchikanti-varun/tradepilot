const BASE = import.meta.env.VITE_API_URL || '';

// --- Token Management ---
function getToken() {
  return localStorage.getItem('tp_access_token');
}

function getRefreshToken() {
  return localStorage.getItem('tp_refresh_token');
}

export function setTokens(access, refresh) {
  localStorage.setItem('tp_access_token', access);
  if (refresh) localStorage.setItem('tp_refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('tp_access_token');
  localStorage.removeItem('tp_refresh_token');
  localStorage.removeItem('tp_user');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('tp_user'));
  } catch { return null; }
}

export function setStoredUser(user) {
  localStorage.setItem('tp_user', JSON.stringify(user));
}

export function isLoggedIn() {
  return !!getToken();
}

// --- HTTP Helpers with Auth ---
function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res) {
  if (res.status === 401) {
    // Try refresh
    const refreshed = await tryRefresh();
    if (!refreshed) {
      clearTokens();
      window.dispatchEvent(new Event('tp_logout'));
      throw new Error('Session expired. Please login again.');
    }
    throw new Error('RETRY');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  return res.json();
}

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, null);
    return true;
  } catch { return false; }
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  return handleResponse(res);
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// --- Auth API ---
export const auth = {
  signup: (email, password, name) => post('/api/auth/signup', { email, password, name }),
  login: (email, password) => post('/api/auth/login', { email, password }),
  me: () => get('/api/auth/me'),
  credentialsStatus: () => get('/api/auth/credentials-status'),
  saveBrokerCreds: (creds) => post('/api/auth/broker-credentials', creds),
  saveGroqKey: (key) => post('/api/auth/groq-key', { groq_api_key: key }),
};

// --- App API ---
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
  newsAnalysis: () => get('/api/news/analyze'),
  alerts: () => get('/api/alerts'),
  sectors: () => get('/api/market/sectors'),
  movers: () => get('/api/market/movers'),
  screener: () => get('/api/screener'),
  screenerTimeframe: (tf = '1h') => get(`/api/screener/timeframe?tf=${tf}`),
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
  removeFavorite: (symbol) => del(`/api/favorites/${symbol}`),
  priceAlerts: () => get('/api/alerts/price'),
  createPriceAlert: (symbol, price, direction) => post('/api/alerts/price', { symbol, target_price: price, direction }),
  deletePriceAlert: (id) => del(`/api/alerts/price/${id}`),
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
