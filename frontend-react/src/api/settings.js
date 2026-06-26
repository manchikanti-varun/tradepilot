import { get, post, del } from './client';

export const settingsApi = {
  getAll: () => get('/api/settings/all'),
  saveAll: (settings) => post('/api/settings/save', { settings }),
  setCapital: (capital) => post('/api/capital', { capital }),
  growth: () => get('/api/growth'),
  brief: () => get('/api/brief/today'),
  news: () => get('/api/news'),
  newsAnalysis: () => get('/api/news/analyze'),
  favorites: () => get('/api/favorites'),
  addFavorite: (symbol) => post(`/api/favorites/${symbol}`, {}),
  removeFavorite: (symbol) => del(`/api/favorites/${symbol}`),
  scan: () => post('/api/scan', {}),
};
