import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'https://shoovaone.onrender.com/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
const AUTH_PATHS = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url?.replace(/\/+$/, '');
    const isAuthRequest = AUTH_PATHS.some((path) => requestUrl?.endsWith(path));

    if (error.response?.status === 401 && !isAuthRequest) {
      // A password change revokes older tokens. Requests already in flight
      // with the previous token must not sign the user out of the new one.
      const sentToken = error.config?.headers?.Authorization;
      const currentToken = localStorage.getItem('access_token');
      const staleRequest =
        sentToken && currentToken && sentToken !== `Bearer ${currentToken}`;

      if (!staleRequest) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);