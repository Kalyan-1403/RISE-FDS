import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error(
    '❌ VITE_API_BASE_URL is not set.'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/';
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(
      'access_token'
    );
    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes(
        '/auth/refresh'
      ) &&
      !originalRequest.url.includes(
        '/auth/login'
      )
    ) {
      if (isRefreshing) {
        return new Promise(
          (resolve, reject) => {
            failedQueue.push({
              resolve,
              reject,
            });
          }
        )
          .then((token) => {
            originalRequest.headers.Authorization =
              `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) =>
            Promise.reject(err)
          );
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken =
        localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization:
                `Bearer ${refreshToken}`,
              'Content-Type':
                'application/json',
            },
            timeout: 10000,
          }
        );

        const newAccessToken =
          data.access_token;
        localStorage.setItem(
          'access_token',
          newAccessToken
        );
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization =
          `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) =>
    api.post('/auth/login', data),
  register: (data) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (data) =>
    api.post('/auth/forgot-password', data),
  resetPassword: (data) =>
    api.post('/auth/reset-password', data),
};

export const facultyAPI = {
  getAll: () => api.get('/faculty'),
  getById: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post('/faculty', data),
  update: (id, data) =>
    api.put(`/faculty/${id}`, data),
  delete: (id) =>
    api.delete(`/faculty/${id}`),
};

export const batchAPI = {
  create: (data) =>
    api.post('/batch/create', data),
  getById: (batchId) =>
    api.get(`/batch/${batchId}`),
  list: () => api.get('/batch/list'),
};

export const feedbackAPI = {
  submit: (data) =>
    api.post('/feedback/submit', data),
  getFacultyStats: (facultyId) =>
    api.get(
      `/feedback/faculty/${facultyId}/stats`
    ),
  deleteFacultyResponses: (facultyId) =>
    api.delete(
      `/feedback/faculty/${facultyId}/responses`
    ),
  deleteDepartmentResponses: (college, dept) =>
    api.delete(
      '/feedback/department/responses',
      { data: { college, dept } }
    ),
  deleteCollegeResponses: (college) =>
    api.delete(
      '/feedback/college/responses',
      { data: { college } }
    ),
};

export const dashboardAPI = {
  getAdmin: () => api.get('/dashboard/admin'),
  getHoD: () => api.get('/dashboard/hod'),
  addDepartment: (data) =>
    api.post('/dashboard/department', data),
  deleteDepartment: (college, dept) =>
    api.delete('/dashboard/department', {
      data: { college, dept },
    }),
  deleteCollege: (college) =>
    api.delete('/dashboard/college', {
      data: { college },
    }),
};

export const reportsAPI = {
  getFacultyData: (facultyId) =>
    api.get(
      `/reports/faculty/${facultyId}/data`
    ),
};

export const healthAPI = {
  check: () => api.get('/health'),
};
// Add this to the bottom of api.js
export const fetchAISummary = async (comments, targetName) => {
  try {
    // Note the /api/ai/summarize route matches what we set up in Flask
    const response = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // 'Authorization': `Bearer ${localStorage.getItem('token')}` // Uncomment if your route requires auth
      },
      body: JSON.stringify({ comments, targetName }),
    });
    
    if (!response.ok) throw new Error('Failed to fetch AI summary');
    return await response.json(); 
  } catch (error) {
    console.error('Error fetching AI summary:', error);
    return null;
  }
};
export default api;