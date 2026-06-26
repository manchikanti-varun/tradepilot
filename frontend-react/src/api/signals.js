import { get, post, del } from './client';

export const signalsApi = {
  current: () => get('/api/signals'),
  history: (limit = 50) => get(`/api/signals/history?limit=${limit}`),
  alerts: () => get('/api/alerts'),
  priceAlerts: () => get('/api/alerts/price'),
  createPriceAlert: (symbol, price, direction) => post('/api/alerts/price', { symbol, target_price: price, direction }),
  deletePriceAlert: (id) => del(`/api/alerts/price/${id}`),
};
