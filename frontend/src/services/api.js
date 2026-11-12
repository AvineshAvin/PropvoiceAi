import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export function formatINR(amount, listingType = 'buy') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return 'Not specified';
  }
  const num = Number(amount);
  const suffix = listingType === 'rent' ? '/mo' : '';
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr${suffix}`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)} L${suffix}`;
  }
  return `₹${num.toLocaleString('en-IN')}${suffix}`;
}

export const agentApi = {
  chat: (payload) => api.post('/api/agent/chat', payload).then((r) => r.data),
  extractRequirements: (payload) =>
    api.post('/api/agent/extract-requirements', payload).then((r) => r.data),
};

export const propertiesApi = {
  list: (params) => api.get('/api/properties', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/properties/${id}`).then((r) => r.data),
  create: (payload) => api.post('/api/properties', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/api/properties/${id}`, payload).then((r) => r.data),
};

export const leadsApi = {
  list: (params) => api.get('/api/leads', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/leads/${id}`).then((r) => r.data),
  create: (payload) => api.post('/api/leads', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/api/leads/${id}`, payload).then((r) => r.data),
};

export const conversationsApi = {
  list: (params) => api.get('/api/conversations', { params }).then((r) => r.data),
  get: (id) => api.get(`/api/conversations/${id}`).then((r) => r.data),
};

export const followupsApi = {
  list: (params) => api.get('/api/followups', { params }).then((r) => r.data),
  create: (payload) => api.post('/api/followups', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/api/followups/${id}`, payload).then((r) => r.data),
};

export const dashboardApi = {
  stats: () => api.get('/api/dashboard/stats').then((r) => r.data),
  health: () => api.get('/api/health').then((r) => r.data),
  getScoringSettings: () => api.get('/api/settings/scoring').then((r) => r.data),
  updateScoringSettings: (payload) =>
    api.put('/api/settings/scoring', payload).then((r) => r.data),
};
