const BASE = import.meta.env.VITE_API_URL || '';

// ─── Token Management ────────────────────────────────────────

function getToken() {
  return localStorage.getItem('tp_access');
}

function getRefreshToken() {
  return localStorage.getItem('tp_refresh');
}

export function setTokens(access, refresh) {
  if (access) localStorage.setItem('tp_access', access);
  if (refresh) localStorage.setItem('tp_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('tp_access');
  localStorage.removeItem('tp_refresh');
  localStorage.removeItem('tp_user');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('tp_user'));
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem('tp_user', JSON.stringify(user));
}

export function isLoggedIn() {
  return !!getToken();
}

// ─── HTTP Internals ──────────────────────────────────────────

function authHeaders() {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

let isRefreshing = false;
let refreshQueue = [];

function enqueueRefresh() {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject });
  });
}

function drainRefreshQueue(success) {
  refreshQueue.forEach(({ resolve, reject }) => {
    success ? resolve() : reject(new Error('Refresh failed'));
  });
  refreshQueue = [];
}

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  // If already refreshing, wait for the in-flight refresh
  if (isRefreshing) {
    try {
      await enqueueRefresh();
      return true;
    } catch {
      return false;
    }
  }

  isRefreshing = true;

  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      drainRefreshQueue(false);
      isRefreshing = false;
      return false;
    }

    const data = await res.json();
    setTokens(data.access_token, null);
    drainRefreshQueue(true);
    isRefreshing = false;
    return true;
  } catch {
    drainRefreshQueue(false);
    isRefreshing = false;
    return false;
  }
}

function handleSessionExpired() {
  clearTokens();
  window.dispatchEvent(new Event('tp_logout'));
}

// ─── Public Fetch Methods ────────────────────────────────────

export async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry with new token
      const retry = await fetch(`${BASE}${path}`, { headers: authHeaders() });
      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${retry.status}`);
      }
      return retry.json();
    }
    handleSessionExpired();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!retry.ok) {
        const retryBody = await retry.json().catch(() => ({}));
        throw new Error(retryBody.detail || `Error ${retry.status}`);
      }
      return retry.json();
    }
    handleSessionExpired();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Error ${res.status}`);
  }
  return res.json();
}

export async function del(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${BASE}${path}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!retry.ok) {
        const retryBody = await retry.json().catch(() => ({}));
        throw new Error(retryBody.detail || `Error ${retry.status}`);
      }
      return retry.json();
    }
    handleSessionExpired();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ─── Utilities ───────────────────────────────────────────────

export function getBaseUrl() {
  return BASE;
}

export function formatCurrency(n) {
  if (n === null || n === undefined) return '—';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatPct(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}
