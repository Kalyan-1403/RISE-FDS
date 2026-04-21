import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error('❌ VITE_API_BASE_URL is not set.');
}

const api = axios.create({
  baseURL: API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  // FIX (CRITICAL): Send httpOnly refresh cookie on cross-origin requests.
  withCredentials: true,
});

// ─── In-Memory Access Token Store ────────────────────────────────────────────
//
// FIX (CRITICAL): Access token is now stored in module memory, NOT localStorage.
// localStorage is readable by any JavaScript on the page (XSS risk).
// Memory storage means the token is cleared on page refresh — that's intentional.
// Session is restored transparently via the httpOnly refresh cookie on page load
// (see AuthContext.jsx → restoreSession).
//
let _accessToken = null;

export const setAccessToken = (token) => {
  _accessToken = token;
};

export const clearAccessToken = () => {
  _accessToken = null;
};

// ─── Request Interceptor ─────────────────────────────────────────────────────
// Attach the in-memory access token as a Bearer header on every request.
api.interceptors.request.use(
  (config) => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor: Silent Token Refresh ───────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

const forceLogout = () => {
  clearAccessToken();
  localStorage.removeItem('user');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/';
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

    try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true, timeout: 60000 },
        );

        const newAccessToken = data.access_token;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Only force logout if the server explicitly rejected the session
        // (401/403). A network error or timeout means the server is
        // temporarily unreachable — do NOT log the user out.
        if (refreshError.response && (refreshError.response.status === 401 || refreshError.response.status === 403)) {
          forceLogout();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }

    return Promise.reject(error);
  },
);

// ─── API Modules ─────────────────────────────────────────────────────────────

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh', {}, { timeout: 60000 }),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
  registerAdmin: (data) => api.post('/auth/register-admin', data),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const facultyAPI = {
  getAll: () => api.get('/faculty'),
  getById: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post('/faculty', data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`),
};

export const batchAPI = {
  create: (data) => api.post('/batch/create', data),
  getById: (batchId) => api.get(`/batch/${batchId}`),
  list: () => api.get('/batch/list'),
  revoke: (batchId) => api.delete(`/batch/${batchId}/revoke`),
};

export const sectionAPI = {
  getAll: () => api.get('/batch/sections'),
  create: (data) => api.post('/batch/sections', data),
  update: (id, data) => api.put(`/batch/sections/${id}`, data),
  delete: (id) => api.delete(`/batch/sections/${id}`),
};
export const feedbackAPI = {
  submit: (data) => api.post('/feedback/submit', data),
  getFacultyStats: (facultyId) => api.get(`/feedback/faculty/${facultyId}/stats`),
  getMultiFacultyStats: (facultyIds) => api.post('/feedback/faculty/stats/multi', { faculty_ids: facultyIds }),
  deleteFacultyResponses: (facultyId) => api.delete(`/feedback/faculty/${facultyId}/responses`),
  deleteDepartmentResponses: (college, dept) =>
    api.delete('/feedback/department/responses', { data: { college, dept } }),
  deleteCollegeResponses: (college) =>
    api.delete('/feedback/college/responses', { data: { college } }),
};

export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getHoD: () => api.get('/dashboard/hod'),
  addDepartment: (data) => api.post('/dashboard/department', data),
  deleteDepartment: (college, dept) =>
    api.delete('/dashboard/department', { data: { college, dept } }),
  deleteCollege: (college) =>
    api.delete('/dashboard/college', { data: { college } }),
};

export const reportsAPI = {
  getFacultyData: (facultyId) => api.get(`/reports/faculty/${facultyId}/data`),
};

export const healthAPI = {
  check: () => api.get('/health'),
};

// FIX (HIGH): Removed the broken fetchAISummary function.
// The /api/ai/summarize backend route was never implemented, causing silent 404s
// in production. Re-add this when the backend route is properly built and
// secured with JWT authentication.

export default api;
