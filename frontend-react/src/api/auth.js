import { get, post } from './client';

export const authApi = {
  signup: (email, password, name) => post('/api/auth/signup', { email, password, name }),
  login: (email, password) => post('/api/auth/login', { email, password }),
  me: () => get('/api/auth/me'),
  credentialsStatus: () => get('/api/auth/credentials-status'),
  saveBrokerCreds: (creds) => post('/api/auth/broker-credentials', creds),
  saveGroqKey: (key) => post('/api/auth/groq-key', { groq_api_key: key }),
  changePassword: (current, newPw) => post('/api/auth/change-password', { current_password: current, new_password: newPw }),
};
