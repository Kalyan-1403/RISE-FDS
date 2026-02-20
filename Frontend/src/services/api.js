import axios from 'axios';

// Vite uses import.meta.env for environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance with production-safe defaults
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor — attach JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle token expiry globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const code = error.response.data?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
        // Token expired or invalid — force logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========================
// AUTH APIs
// ========================
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
};

// ========================
// FACULTY APIs
// ========================
export const facultyAPI = {
  getAll: () => api.get('/faculty'),
  getById: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post('/faculty', data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`),
};

// ========================
// BATCH APIs
// ========================
export const batchAPI = {
  create: (data) => api.post('/batch/create', data),
  getById: (batchId) => api.get(`/batch/${batchId}`),
  list: () => api.get('/batch/list'),
};

// ========================
// FEEDBACK APIs
// ========================
export const feedbackAPI = {
  submit: (data) => api.post('/feedback/submit', data),
  getFacultyStats: (facultyId) => api.get(`/feedback/faculty/${facultyId}/stats`),
};

// ========================
// DASHBOARD APIs
// ========================
export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getHoD: () => api.get('/dashboard/hod'),
};

// ========================
// REPORTS APIs
// ========================
export const reportsAPI = {
  getFacultyData: (facultyId) => api.get(`/reports/faculty/${facultyId}/data`),
};

// ========================
// HEALTH CHECK
// ========================
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;