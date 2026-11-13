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
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url?.replace(/\/+$/, '');
    const isLoginRequest = requestUrl?.endsWith('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);