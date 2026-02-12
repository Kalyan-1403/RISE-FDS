import axios from 'axios';

// Base API URL
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  createAccount: (data) => api.post('/auth/create-account', data),
  verifyUser: (userId) => api.post('/auth/verify-user', { user_id: userId }),
  sendOTP: (data) => api.post('/auth/forgot-password/send-otp', data),
  verifyOTP: (data) => api.post('/auth/forgot-password/verify-otp', data),
  resetPassword: (data) => api.post('/auth/forgot-password/reset', data),
  getCurrentUser: () => api.get('/auth/me'),
};

// Faculty APIs
export const facultyAPI = {
  getAll: () => api.get('/faculty'),
  getById: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post('/faculty', data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`),
  getByBranch: (branch) => api.get(`/faculty/by-branch/${branch}`),
  getByYear: (year) => api.get(`/faculty/by-year/${year}`),
};

// Batch APIs
export const batchAPI = {
  create: (data) => api.post('/batch/create', data),
  getById: (batchId) => api.get(`/batch/${batchId}`),
  getList: () => api.get('/batch/list'),
  getDetails: (batchId) => api.get(`/batch/${batchId}/details`),
  getFaculty: (batchId) => api.get(`/batch/${batchId}/faculty`),
};

// Feedback APIs
export const feedbackAPI = {
  submit: (data) => api.post('/feedback/submit', data),
  getBatchCount: (batchId) => api.get(`/feedback/batch/${batchId}/count`),
  getFacultyStats: (facultyId) => api.get(`/feedback/faculty/${facultyId}/stats`),
  getBatchStats: (batchId) => api.get(`/feedback/batch/${batchId}/stats`),
};

// Dashboard APIs
export const dashboardAPI = {
  getHoDDashboard: () => api.get('/dashboard/hod'),
  getAdminDashboard: () => api.get('/dashboard/admin'),
  getFacultyAnalytics: () => api.get('/dashboard/faculty-analytics'),
};

// Reports APIs
export const reportsAPI = {
  getFacultyExcel: (facultyId) => {
    return api.get(`/reports/faculty/${facultyId}/excel`, {
      responseType: 'blob',
    });
  },
  getFacultyPDF: (facultyId) => {
    return api.get(`/reports/faculty/${facultyId}/pdf`, {
      responseType: 'blob',
    });
  },
  getBatchExcel: (batchId) => {
    return api.get(`/reports/batch/${batchId}/excel`, {
      responseType: 'blob',
    });
  },
};

export default api;
