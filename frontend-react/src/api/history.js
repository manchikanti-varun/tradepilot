import { get, post, getBaseUrl } from './client';

export const historyApi = {
  list: (limit = 60) => get(`/api/history?limit=${limit}`),
  exportUrl: () => {
    const token = localStorage.getItem('tp_access');
    const base = `${getBaseUrl()}/api/history/export`;
    return token ? `${base}?token=${token}` : base;
  },
  notes: (tradeId) => get(`/api/history/${tradeId}/notes`),
  addNote: (tradeId, note, tags) => post(`/api/history/${tradeId}/notes`, { note, tags }),
  stats: () => get('/api/stats'),
  performance: () => get('/api/performance'),
  timePerformance: () => get('/api/stats/time-performance'),
  realityCheck: () => get('/api/report/reality-check'),
  coachReport: () => get('/api/report/today'),
  eodSummary: () => get('/api/eod-summary'),
  insights: () => get('/api/insights'),
  rejections: () => get('/api/rejections/today'),
};
