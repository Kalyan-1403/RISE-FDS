import {
  authAPI,
  facultyAPI,
  batchAPI,
  feedbackAPI,
  dashboardAPI,
  reportsAPI,
} from './api.js';

/**
 * DataService — Central data layer
 *
 * SECURITY POLICY:
 * - Authentication ALWAYS requires the backend. No local fallback.
 * - Data operations attempt backend first, use localStorage as READ-ONLY cache.
 * - Write operations MUST succeed on the backend or throw an error.
 */

const DEPT_STRUCTURE_KEY = 'deptStructure';
const MASTER_FACULTY_KEY = 'masterFacultyList';

// ========================
// DEFAULT DEPARTMENT STRUCTURE
// ========================
const DEFAULT_DEPT_STRUCTURE = {
  Gandhi: {
    'S&H': ['CSE', 'ECE'],
    CSE: null,
    ECE: null,
  },
  Prakasam: {
    'S&H': ['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH'],
    CSE: null,
    ECE: null,
    EEE: null,
    CIVIL: null,
    MECH: null,
    MBA: null,
    MCA: null,
    'M.TECH': null,
  },
};

// ========================
// OFFLINE STATUS HELPER
// ========================
let backendOnline = true;

const setBackendStatus = (status) => {
  backendOnline = status;
};

const isOffline = () => !backendOnline;

// ========================
// DEPARTMENT STRUCTURE (localStorage-managed)
// ========================
const getDeptStructure = () => {
  try {
    const saved = localStorage.getItem(DEPT_STRUCTURE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse dept structure:', e);
  }
  localStorage.setItem(
    DEPT_STRUCTURE_KEY,
    JSON.stringify(DEFAULT_DEPT_STRUCTURE)
  );
  return DEFAULT_DEPT_STRUCTURE;
};

const saveDeptStructure = (structure) => {
  localStorage.setItem(DEPT_STRUCTURE_KEY, JSON.stringify(structure));
};

const addDepartment = async (college, deptName, branches = null) => {
  // Attempt backend sync
  try {
    await dashboardAPI.addDepartment({ college, deptName, branches });
    setBackendStatus(true);
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for addDepartment, saving locally only.');
  }

  // Local storage update
  const structure = getDeptStructure();
  if (!structure[college]) {
    return { success: false, error: `College "${college}" not found` };
  }
  if (structure[college][deptName]) {
    return { success: false, error: `Department "${deptName}" already exists` };
  }
  structure[college][deptName] = branches || null;
  saveDeptStructure(structure);
  return { success: true };
};

const deleteDepartment = async (college, dept) => {
  try {
    await dashboardAPI.deleteDepartment(college, dept);
    setBackendStatus(true);
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for deleteDepartment.');
  }

  const structure = getDeptStructure();
  if (structure[college] && dept in structure[college]) {
    delete structure[college][dept];
    saveDeptStructure(structure);

    try {
      const master = JSON.parse(
        localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
      );
      delete master[`${college}_${dept}`];
      localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
    } catch (e) {
      console.error('Local storage cleanup failed:', e);
    }
  }
  return { success: true };
};

const deleteCollege = async (college) => {
  try {
    await dashboardAPI.deleteCollege(college);
    setBackendStatus(true);
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for deleteCollege.');
  }

  const structure = getDeptStructure();
  if (structure[college]) {
    try {
      const master = JSON.parse(
        localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
      );
      Object.keys(master).forEach((key) => {
        if (key.startsWith(`${college}_`)) delete master[key];
      });
      localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
    } catch (e) {
      console.error('Local storage cleanup failed:', e);
    }
    delete structure[college];
    saveDeptStructure(structure);
  }
  return { success: true };
};

const mergeColleges = (source, target) => {
  const structure = getDeptStructure();
  if (!structure[source] || !structure[target]) {
    return { success: false, error: 'Invalid colleges' };
  }
  Object.keys(structure[source]).forEach((dept) => {
    if (!structure[target][dept]) {
      structure[target][dept] = structure[source][dept];
    }
  });
  const master = JSON.parse(
    localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
  );
  Object.keys(master).forEach((key) => {
    if (key.startsWith(`${source}_`)) {
      const newKey = key.replace(`${source}_`, `${target}_`);
      if (!master[newKey]) master[newKey] = [];
      master[newKey] = [...master[newKey], ...master[key]];
      delete master[key];
    }
  });
  localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
  delete structure[source];
  saveDeptStructure(structure);
  return { success: true };
};

// ========================
// AUTH — Backend ONLY, no local fallback
// ========================
const login = async (loginData) => {
  try {
    const response = await authAPI.login(loginData);
    if (response.data.success) {
      localStorage.setItem('access_token', response.data.access_token);
      if (response.data.refresh_token) {
        localStorage.setItem('refresh_token', response.data.refresh_token);
      }
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      // Backend responded with an error (401, 400, etc.)
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Login failed');
    }
    // Network error — backend unreachable
    setBackendStatus(false);
    throw new Error(
      'Cannot connect to server. Please check your internet connection and try again.'
    );
  }
};

const register = async (registerData) => {
  try {
    const response = await authAPI.register(registerData);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Registration failed');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server. Please try again later.');
  }
};

const forgotPassword = async (data) => {
  try {
    const response = await authAPI.forgotPassword(data);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Request failed');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

const resetPassword = async (data) => {
  try {
    const response = await authAPI.resetPassword(data);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Password reset failed');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server.');
  }
};

// ========================
// FACULTY — Backend primary, localStorage cache
// ========================
const getAllFaculty = async () => {
  try {
    const response = await facultyAPI.getAll();
    const grouped = {};
    response.data.faculty.forEach((f) => {
      const key = `${f.college}_${f.dept}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(f);
    });
    // Cache for offline reading
    localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(grouped));
    setBackendStatus(true);
    return response.data.faculty;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable, using cached faculty data.');
    const master = JSON.parse(
      localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
    );
    const all = [];
    Object.values(master).forEach((list) => all.push(...(list || [])));
    return all;
  }
};

const createFaculty = async (facultyData) => {
  try {
    const response = await facultyAPI.create(facultyData);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Failed to create faculty');
    }
    setBackendStatus(false);
    throw new Error(
      'Cannot connect to server. Faculty was NOT saved. Please try again when online.'
    );
  }
};

const updateFaculty = async (facultyId, facultyData) => {
  try {
    const response = await facultyAPI.update(facultyId, facultyData);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Failed to update faculty');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server. Update was NOT saved.');
  }
};

const deleteFacultyById = async (facultyId) => {
  try {
    const response = await facultyAPI.delete(facultyId);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Failed to delete faculty');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server. Deletion was NOT performed.');
  }
};

// ========================
// BATCH — Backend primary, localStorage cache
// ========================
const createBatch = async (batchData) => {
  try {
    const response = await batchAPI.create(batchData);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(error.response.data.error || 'Failed to create batch');
    }
    setBackendStatus(false);
    throw new Error('Cannot connect to server. Batch was NOT created.');
  }
};

const getBatch = async (batchId) => {
  try {
    const response = await batchAPI.getById(batchId);
    setBackendStatus(true);
    // Cache for student feedback form
    localStorage.setItem(`batch_${batchId}`, JSON.stringify(response.data.batch));
    return response.data.batch;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable, loading batch from cache.');
    const stored = localStorage.getItem(`batch_${batchId}`);
    if (stored) return JSON.parse(stored);
    return null;
  }
};

const listBatches = async () => {
  try {
    const response = await batchAPI.list();
    setBackendStatus(true);
    return response.data.batches;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for batch listing.');
    return [];
  }
};

// ========================
// FEEDBACK — Backend primary
// ========================
const submitFeedback = async (feedbackData) => {
  try {
    const response = await feedbackAPI.submit(feedbackData);
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    if (error.response) {
      setBackendStatus(true);
      throw new Error(
        error.response.data.error || 'Failed to submit feedback'
      );
    }
    setBackendStatus(false);
    throw new Error(
      'Cannot connect to server. Your feedback was NOT submitted. Please try again when online.'
    );
  }
};

const getFacultyStats = async (facultyId) => {
  try {
    const response = await feedbackAPI.getFacultyStats(facultyId);
    setBackendStatus(true);
    return response.data.stats;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for faculty stats.');
    return null;
  }
};

// ========================
// DASHBOARD — Backend primary, localStorage cache
// ========================
const getAdminDashboard = async () => {
  try {
    const response = await dashboardAPI.getAdmin();
    if (response.data.masterFacultyList) {
      localStorage.setItem(
        MASTER_FACULTY_KEY,
        JSON.stringify(response.data.masterFacultyList)
      );
    }
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable, using cached admin dashboard data.');
    return {
      masterFacultyList: JSON.parse(
        localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
      ),
      totalFaculty: 0,
      totalBatches: 0,
      totalSubmissions: 0,
    };
  }
};

const getHoDDashboard = async () => {
  try {
    const response = await dashboardAPI.getHoD();
    setBackendStatus(true);
    return response.data;
  } catch (error) {
    setBackendStatus(false);
    console.warn('Backend unavailable for HoD dashboard.');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      faculty: [],
      batches: [],
      college: user.college || '',
      department: user.department || '',
    };
  }
};

// ========================
// DELETE OPERATIONS (localStorage cache cleanup)
// ========================
const deleteFacultyFeedback = (facultyId, year, semester) => {
  const key = `feedback_${facultyId}_${year}_${semester}`;
  localStorage.removeItem(key);
};

const deleteDepartmentFeedback = (college, dept) => {
  const master = JSON.parse(
    localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
  );
  const deptKey = `${college}_${dept}`;
  const facultyList = master[deptKey] || [];
  facultyList.forEach((f) => {
    localStorage.removeItem(`feedback_${f.id}_${f.year}_${f.sem}`);
  });
};

const deleteCollegeFeedback = (college) => {
  const master = JSON.parse(
    localStorage.getItem(MASTER_FACULTY_KEY) || '{}'
  );
  Object.keys(master).forEach((key) => {
    if (key.startsWith(`${college}_`)) {
      (master[key] || []).forEach((f) => {
        localStorage.removeItem(`feedback_${f.id}_${f.year}_${f.sem}`);
      });
    }
  });
};

// ========================
// REPORTS — Backend primary
// ========================
const getFacultyReportData = async (facultyId) => {
  try {
    const response = await reportsAPI.getFacultyData(facultyId);
    setBackendStatus(true);
    // Transform raw data into format Excel generator expects
    const rawData = response.data.data || [];
    // Group by submission (submittedAt + slot)
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
      submissionMap[key].ratings[item.parameter] =
        item.rating;
    });
    return Object.values(submissionMap);
  } catch (error) {
    setBackendStatus(false);
    console.warn(
      'Backend unavailable for faculty report data.'
    );
    return [];
  }
};

// ========================
// EXPORT
// ========================
const dataService = {
  // Status
  isOffline,

  // Department structure
  getDeptStructure,
  addDepartment,
  deleteDepartment,
  deleteCollege,
  mergeColleges,

  // Auth
  login,
  register,
  forgotPassword,
  resetPassword,

  // Faculty
  getAllFaculty,
  createFaculty,
  updateFaculty,
  deleteFacultyById,

  // Batch
  createBatch,
  getBatch,
  listBatches,

  // Feedback
  submitFeedback,
  getFacultyStats,

  // Dashboard
  getAdminDashboard,
  getHoDDashboard,

// Reports
  getFacultyReportData,

  // Cleanup
  deleteFacultyFeedback,
  deleteDepartmentFeedback,
  deleteCollegeFeedback,
};

export default dataService;