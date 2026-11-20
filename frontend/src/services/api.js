import axios from 'axios';
import { API_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to inject JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // For multipart FormData uploads, ensure Content-Type is removed so browser sets boundary
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
          config.headers.delete('content-type');
        }
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to format responses and handle 401 unauthorized errors
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401 && !error.config?.url?.includes('verify-password')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Standardize error output
    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject({
      success: false,
      message: message,
      status: error.response?.status
    });
  }
);

export default api;
