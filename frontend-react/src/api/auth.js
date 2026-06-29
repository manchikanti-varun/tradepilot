import { get, post } from './client';

export const authApi = {
  signup: (email, password, name) => post('/api/auth/signup', { email, password, name }),
  login: (email, password) => post('/api/auth/login', { email, password }),
  me: () => get('/api/auth/me'),
  credentialsStatus: () => get('/api/auth/credentials-status'),
  saveBrokerCreds: (creds) => post('/api/auth/broker-credentials', creds),
  saveGroqKey: (key, key2) => {
    const body = { groq_api_key: key };
    if (key2) body.groq_api_key_2 = key2;
    return post('/api/auth/groq-key', body);
  },
  changePassword: (current, newPw) => post('/api/auth/change-password', { current_password: current, new_password: newPw }),
};
