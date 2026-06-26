import { get } from './client';

export const marketApi = {
  state: () => get('/api/state'),
  countdown: () => get('/api/market/countdown'),
  expiry: () => get('/api/market/expiry'),
  sectors: () => get('/api/market/sectors'),
  movers: () => get('/api/market/movers'),
  premarket: () => get('/api/market/premarket'),
  week52: () => get('/api/market/52week'),
  watchlist: () => get('/api/watchlist'),
  screener: () => get('/api/screener'),
  screenerTimeframe: (tf = '1h') => get(`/api/screener/timeframe?tf=${tf}`),
  chart: (symbol, interval = '5m') => get(`/api/chart/${symbol}?interval=${interval}`),
  stockPlan: (symbol) => get(`/api/stock/${symbol}/plan`),
  stockMultiframe: (symbol) => get(`/api/stock/${symbol}/multiframe`),
};
