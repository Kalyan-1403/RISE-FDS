import {
  authAPI,
  facultyAPI,
  batchAPI,
  sectionAPI,
  feedbackAPI,
  dashboardAPI,
  reportsAPI,
  setAccessToken,
} from './api.js';

const DEPT_STRUCTURE_KEY = 'deptStructure';

const DEFAULT_DEPT_STRUCTURE = {
  Gandhi: {
    'S&H': ['CSE', 'ECE'],
    CSE: null,
    ECE: null,
  },
  Prakasam: {
    'S&H': ['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH'],
    CSE: null, ECE: null, EEE: null,
    CIVIL: null, MECH: null, MBA: null,
    MCA: null, 'M.TECH': null,
  },
};

let backendOnline = true;
const setBackendStatus = (s) => { backendOnline = s; };
const isOffline = () => !backendOnline;

const getDeptStructure = () => {
  try {
    const saved = localStorage.getItem(DEPT_STRUCTURE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { /* ignore */ }
  localStorage.setItem(DEPT_STRUCTURE_KEY, JSON.stringify(DEFAULT_DEPT_STRUCTURE));
  return DEFAULT_DEPT_STRUCTURE;
};

const saveDeptStructure = (structure) => {
  localStorage.setItem(DEPT_STRUCTURE_KEY, JSON.stringify(structure));
};

const addDepartment = async (college, deptName, branches = null) => {
  try {
    await dashboardAPI.addDepartment({ college, deptName, branches });
    setBackendStatus(true);
  } catch (e) {
    setBackendStatus(false);
  }
  const structure = getDeptStructure();
  if (!structure[college]) return { success: false, error: `College "${college}" not found` };
  if (structure[college][deptName]) return { success: false, error: `"${deptName}" already exists` };
  structure[college][deptName] = branches || null;
  saveDeptStructure(structure);
  return { success: true };
};

const deleteDepartment = async (college, dept) => {
  try {
    await dashboardAPI.deleteDepartment(college, dept);
    setBackendStatus(true);
  } catch (e) {
    setBackendStatus(false);
  }
  const structure = getDeptStructure();
  if (structure[college] && dept in structure[college]) {
    delete structure[college][dept];
    saveDeptStructure(structure);
  }
  return { success: true };
};

const deleteCollege = async (college) => {
  try {
    await dashboardAPI.deleteCollege(college);
    setBackendStatus(true);
  } catch (e) {
    setBackendStatus(false);
  }
  const structure = getDeptStructure();
  if (structure[college]) {
    delete structure[college];
    saveDeptStructure(structure);
  }
  return { success: true };
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const login = async (loginData) => {
  try {
    const response = await authAPI.login(loginData);
    if (response.data.success) {
      setAccessToken(response.data.access_token);
      // FIX: Removed redundant sessionStorage.setItem('user', ...) write.
      // AuthContext.loginUser() is responsible for persisting the user profile
      // to localStorage and updating React state. Writing to sessionStorage here
      // created a diverging secondary cache that was never read back, causing
      // stale data to persist across logouts in the same browser tab.
    }
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Login failed');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

const register = async (data) => {
  try {
    const r = await authAPI.register(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Registration failed'); }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

const forgotPassword = async (data) => {
  try {
    const r = await authAPI.forgotPassword(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const registerAdmin = async (data) => {
  try {
    const r = await authAPI.registerAdmin(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Registration failed'); }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

const deleteAccount = async (password) => {
  try {
    const r = await authAPI.deleteAccount(password);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to delete account'); }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

const resetPassword = async (data) => {
  try {
    const r = await authAPI.resetPassword(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const updateProfile = async (data) => {
  try {
    const r = await authAPI.updateProfile(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to update profile'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const changePassword = async (data) => {
  try {
    const r = await authAPI.changePassword(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to change password'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

// ─── FACULTY ──────────────────────────────────────────────────────────────────

const getAllFaculty = async () => {
  try {
    const r = await facultyAPI.getAll();
    setBackendStatus(true);
    return r.data.faculty;
  } catch (e) {
    setBackendStatus(false);
    return [];
  }
};

const createFaculty = async (data) => {
  try {
    const r = await facultyAPI.create(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to create'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const updateFaculty = async (id, data) => {
  try {
    const r = await facultyAPI.update(id, data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to update'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const deleteFacultyById = async (id) => {
  try {
    const r = await facultyAPI.delete(id);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to delete'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────
// FIX: These functions were missing from dataService entirely. sectionAPI was
// defined in api.js but never wrapped here, making section management inaccessible
// to any component going through the service layer.

const getSections = async () => {
  try {
    const r = await sectionAPI.getAll();
    setBackendStatus(true);
    return r.data.sections;
  } catch (e) {
    setBackendStatus(false);
    return [];
  }
};

const createSection = async (data) => {
  try {
    const r = await sectionAPI.create(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to create section'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const updateSection = async (id, data) => {
  try {
    const r = await sectionAPI.update(id, data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to update section'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const deleteSection = async (id) => {
  try {
    const r = await sectionAPI.delete(id);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to delete section'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

// ─── BATCH ────────────────────────────────────────────────────────────────────

const createBatch = async (data) => {
  try {
    const r = await batchAPI.create(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to create batch'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const getBatch = async (batchId) => {
  try {
    const r = await batchAPI.getById(batchId);
    setBackendStatus(true);
    return r.data.batch;
  } catch (e) {
    setBackendStatus(false);
    return null;
  }
};

const listBatches = async () => {
  try {
    const r = await batchAPI.list();
    setBackendStatus(true);
    return r.data.batches;
  } catch (e) {
    setBackendStatus(false);
    return [];
  }
};

const revokeBatch = async (batchId) => {
  try {
    const r = await batchAPI.revoke(batchId);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to revoke'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const deactivateBatch = async (batchId) => {
  try {
    const r = await batchAPI.deactivate(batchId);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to delete link'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};
// ─── FEEDBACK ─────────────────────────────────────────────────────────────────

const submitFeedback = async (data) => {
  try {
    const r = await feedbackAPI.submit(data);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    if (e.response) { setBackendStatus(true); throw new Error(e.response.data.error || 'Failed to submit'); }
    setBackendStatus(false);
    throw new Error('Cannot connect.');
  }
};

const getFacultyStats = async (facultyId) => {
  try {
    const r = await feedbackAPI.getFacultyStats(facultyId);
    setBackendStatus(true);
    return r.data.stats;
  } catch (e) {
    setBackendStatus(false);
    return null;
  }
};

const getMultiFacultyStats = async (facultyIds) => {
  try {
    const r = await feedbackAPI.getMultiFacultyStats(facultyIds);
    setBackendStatus(true);
    return r.data.stats;
  } catch (e) {
    setBackendStatus(false);
    return null;
  }
};

const deleteFacultyFeedback = async (facultyId) => {
  try {
    const r = await feedbackAPI.deleteFacultyResponses(facultyId);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    setBackendStatus(false);
    throw new Error('Failed to delete responses');
  }
};

const deleteDepartmentFeedback = async (college, dept) => {
  try {
    const r = await feedbackAPI.deleteDepartmentResponses(college, dept);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    setBackendStatus(false);
    throw new Error('Failed to delete responses');
  }
};

const deleteCollegeFeedback = async (college) => {
  try {
    const r = await feedbackAPI.deleteCollegeResponses(college);
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    setBackendStatus(false);
    throw new Error('Failed to delete responses');
  }
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

const getAdminDashboard = async () => {
  try {
    const r = await dashboardAPI.getAdmin();
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    setBackendStatus(false);
    return { masterFacultyList: {} };
  }
};

const getHoDDashboard = async () => {
  try {
    const r = await dashboardAPI.getHoD();
    setBackendStatus(true);
    return r.data;
  } catch (e) {
    setBackendStatus(false);
    return { faculty: [], batches: [] };
  }
};

// ─── REPORTS ──────────────────────────────────────────────────────────────────

const getFacultyReportData = async (facultyId) => {
  try {
    const r = await reportsAPI.getFacultyData(facultyId);
    setBackendStatus(true);
    const rawData = r.data.data || [];
    const submissionMap = {};
    rawData.forEach((item) => {
      const key = `${item.submittedAt}_${item.slot}`;
      if (!submissionMap[key]) {
        submissionMap[key] = {
          timestamp: item.submittedAt,
          slot: item.slot,
          ratings: {},
          comments: item.comments || '',
        };
      }
      submissionMap[key].ratings[item.parameter] = item.rating;
    });
    return Object.values(submissionMap);
  } catch (e) {
    setBackendStatus(false);
    return [];
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

const dataService = {
  isOffline,
  getDeptStructure,
  addDepartment,
  deleteDepartment,
  deleteCollege,
  // Auth
  login,
  register,
  registerAdmin,
  forgotPassword,
  resetPassword,
  deleteAccount,
  updateProfile,
  changePassword,
  // Faculty
  getAllFaculty,
  createFaculty,
  updateFaculty,
  deleteFacultyById,
  // Sections (FIX: previously missing)
  getSections,
  createSection,
  updateSection,
  deleteSection,
  // Batches
  createBatch,
  getBatch,
  listBatches,
  revokeBatch,
  deactivateBatch,
  // Feedback
  submitFeedback,
  getFacultyStats,
  getMultiFacultyStats,
  deleteFacultyFeedback,
  deleteDepartmentFeedback,
  deleteCollegeFeedback,
  // Dashboard
  getAdminDashboard,
  getHoDDashboard,
  // Reports
  getFacultyReportData,
};

export default dataService;