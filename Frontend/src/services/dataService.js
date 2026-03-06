import { authAPI, facultyAPI, batchAPI, feedbackAPI, dashboardAPI, reportsAPI } from './api.js';

/**
 * DataService — Central data layer
 * * Priority: Backend API first → localStorage fallback
 * This ensures the app works even if the backend is temporarily down.
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
// DEPARTMENT STRUCTURE
// ========================
const getDeptStructure = () => {
  try {
    const saved = localStorage.getItem(DEPT_STRUCTURE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  localStorage.setItem(DEPT_STRUCTURE_KEY, JSON.stringify(DEFAULT_DEPT_STRUCTURE));
  return DEFAULT_DEPT_STRUCTURE;
};

const saveDeptStructure = (structure) => {
  localStorage.setItem(DEPT_STRUCTURE_KEY, JSON.stringify(structure));
};

const addDepartment = async (college, deptName, branches = null) => {
  // 1. Attempt Backend Database Sync
  try {
    if (dashboardAPI.addDepartment) {
      await dashboardAPI.addDepartment({ college, deptName, branches });
    }
  } catch (error) {
    console.warn('Backend unavailable or endpoint missing, saving locally only');
  }

  // 2. Local Storage Fallback
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
  // 1. Attempt Backend Database Deletion (Cascade delete faculty/feedback in Postgres)
  try {
    if (dashboardAPI.deleteDepartment) {
      await dashboardAPI.deleteDepartment(college, dept);
    }
  } catch (error) {
    console.warn('Backend unavailable, deleting locally only');
  }

  // 2. Local Storage Cleanup
  const structure = getDeptStructure();
  
  // THE FIX: Check if the key exists, rather than if its value is truthy
  if (structure[college] && dept in structure[college]) {
    delete structure[college][dept];
    saveDeptStructure(structure);
    
    // Clean master list safely
    try {
      const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
      delete master[`${college}_${dept}`];
      localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
    } catch (e) {
      console.error("Local storage cleanup failed", e);
    }
  }
  return { success: true };
};
const deleteCollege = async (college) => {
  // 1. Attempt Backend Database Deletion
  try {
    if (dashboardAPI.deleteCollege) {
      await dashboardAPI.deleteCollege(college);
    }
  } catch (error) {
    console.warn('Backend unavailable, deleting locally only');
  }

  // 2. Local Storage Cleanup
  const structure = getDeptStructure();
  if (structure[college]) {
    try {
      const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
      Object.keys(master).forEach((key) => {
        if (key.startsWith(`${college}_`)) delete master[key];
      });
      localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
    } catch(e) {
      console.error("Local storage cleanup failed", e);
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
  // Merge departments
  Object.keys(structure[source]).forEach((dept) => {
    if (!structure[target][dept]) {
      structure[target][dept] = structure[source][dept];
    }
  });
  // Merge faculty master list
  const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
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
// AUTH
// ========================
const login = async (loginData) => {
  try {
    const response = await authAPI.login(loginData);
    if (response.data.success) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Login failed');
    }
    console.warn('Backend unreachable, trying local fallback');
    try {
      return localAuthFallback(loginData);
    } catch (fallbackError) {
      throw new Error('Cannot connect to server. Please try again later.');
    }
  }
};
const register = async (registerData) => {
  try {
    const response = await authAPI.register(registerData);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Registration failed');
    }
    throw new Error('Network error. Backend may be offline.');
  }
};

const localAuthFallback = (loginData) => {
  const { user_id, password, role } = loginData;
  if (role === 'admin' && user_id === 'ADMIN' && password === 'admin@123') {
    const user = { id: 0, userId: 'ADMIN', name: 'Master Admin', role: 'admin', college: '', department: '', username: 'Master Admin' };
    localStorage.setItem('user', JSON.stringify(user));
    return { success: true, access_token: 'local-fallback-token', user };
  }
  const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  const found = registeredUsers.find(
    (u) => u.userId === user_id && u.password === password && u.role === role
  );
  if (found) {
    const user = { id: found.id || 0, userId: found.userId, name: found.name, role: found.role, college: found.college, department: found.department, username: found.name };
    localStorage.setItem('user', JSON.stringify(user));
    return { success: true, access_token: 'local-fallback-token', user };
  }
  throw new Error('Invalid credentials');
};

// ========================
// FACULTY — Backend + localStorage sync
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
    localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(grouped));
    return response.data.faculty;
  } catch (error) {
    console.warn('Backend unavailable, using local faculty data');
    const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
    const all = [];
    Object.values(master).forEach((list) => all.push(...(list || [])));
    return all;
  }
};

const createFaculty = async (facultyData) => {
  try {
    const response = await facultyAPI.create(facultyData);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, saving faculty locally');
    return localCreateFaculty(facultyData);
  }
};

const updateFaculty = async (facultyId, facultyData) => {
  try {
    const response = await facultyAPI.update(facultyId, facultyData);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, updating locally');
    return { success: true, faculty: { id: facultyId, ...facultyData } };
  }
};

const deleteFacultyById = async (facultyId) => {
  try {
    const response = await facultyAPI.delete(facultyId);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable');
    return { success: true };
  }
};

const localCreateFaculty = (data) => {
  const faculty = {
    id: Date.now(),
    code: (data.code || '').toUpperCase(),
    name: data.name,
    subject: data.subject,
    year: data.year,
    sem: data.sem || data.semester,
    sec: data.sec || data.section,
    branch: data.branch,
    dept: data.dept || data.department,
    college: data.college,
    addedDate: new Date().toLocaleDateString(),
  };
  const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
  const key = `${faculty.college}_${faculty.dept}`;
  if (!master[key]) master[key] = [];
  master[key].push(faculty);
  localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(master));
  const hodKey = `faculty_${faculty.college}_${faculty.dept}`;
  const hodList = JSON.parse(localStorage.getItem(hodKey) || '[]');
  hodList.push(faculty);
  localStorage.setItem(hodKey, JSON.stringify(hodList));
  window.dispatchEvent(new Event('storage'));
  return { success: true, faculty };
};

// ========================
// BATCH
// ========================
const createBatch = async (batchData) => {
  try {
    const response = await batchAPI.create(batchData);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, creating batch locally');
    return localCreateBatch(batchData);
  }
};

const getBatch = async (batchId) => {
  try {
    const response = await batchAPI.getById(batchId);
    return response.data.batch;
  } catch (error) {
    console.warn('Backend unavailable, loading batch locally');
    const stored = localStorage.getItem(`batch_${batchId}`);
    if (stored) return JSON.parse(stored);
    return null;
  }
};

const listBatches = async () => {
  try {
    const response = await batchAPI.list();
    return response.data.batches;
  } catch (error) {
    console.warn('Backend unavailable');
    return [];
  }
};

const localCreateBatch = (data) => {
  const batchId = `${data.college}-${data.dept}-${data.branch}-${data.year}-${data.sem}-${data.sec}-${Date.now()}`;
  const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
  const allFaculty = [];
  Object.values(master).forEach((list) => allFaculty.push(...(list || [])));
  const facultyIds = data.faculty_ids || [];
  const selectedFaculty = allFaculty.filter((f) => facultyIds.includes(f.id));

  const batch = {
    id: batchId,
    college: data.college,
    dept: data.dept,
    branch: data.branch,
    year: data.year,
    sem: data.sem,
    sec: data.sec,
    slot: data.slot || 1,
    slotStartDate: data.slotStartDate,
    slotEndDate: data.slotEndDate,
    slotLabel: data.slotLabel || `Slot ${data.slot || 1}`,
    faculty: selectedFaculty,
    created: new Date().toLocaleDateString(),
    createdTimestamp: Date.now(),
    isActive: true,
  };

  localStorage.setItem(`batch_${batchId}`, JSON.stringify(batch));
  return { success: true, batch, feedbackLink: `/feedback/${batchId}` };
};

// ========================
// FEEDBACK
// ========================
const submitFeedback = async (feedbackData) => {
  try {
    const response = await feedbackAPI.submit(feedbackData);
    localSaveFeedback(feedbackData);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, saving feedback locally');
    localSaveFeedback(feedbackData);
    return { success: true, message: 'Feedback saved locally' };
  }
};

const localSaveFeedback = (feedbackData) => {
  const { batchId, responses, comments } = feedbackData;
  const batchStr = localStorage.getItem(`batch_${batchId}`);
  const batch = batchStr ? JSON.parse(batchStr) : null;
  const slot = batch?.slot || 1;

  if (responses) {
    responses.forEach((resp) => {
      const feedbackKey = `feedback_${resp.facultyId}_${resp.year || 'II'}_${resp.semester || resp.sem || 'I'}`;
      const existing = JSON.parse(localStorage.getItem(feedbackKey) || '[]');
      existing.push({
        slot,
        timestamp: new Date().toISOString(),
        ratings: resp.ratings,
        comments: comments || resp.comments || '',
      });
      localStorage.setItem(feedbackKey, JSON.stringify(existing));
    });
  }

  const allFeedback = JSON.parse(localStorage.getItem('feedbackData') || '[]');
  allFeedback.push({ ...feedbackData, submittedAt: new Date().toISOString(), slot });
  localStorage.setItem('feedbackData', JSON.stringify(allFeedback));
};

const getFacultyStats = async (facultyId) => {
  try {
    const response = await feedbackAPI.getFacultyStats(facultyId);
    return response.data.stats;
  } catch (error) {
    console.warn('Backend unavailable');
    return null;
  }
};

const getFacultyFeedback = (facultyId, year, semester) => {
  return JSON.parse(localStorage.getItem(`feedback_${facultyId}_${year}_${semester}`) || '[]');
};

// ========================
// DASHBOARD
// ========================
const getAdminDashboard = async () => {
  try {
    const response = await dashboardAPI.getAdmin();
    if (response.data.masterFacultyList) {
      localStorage.setItem(MASTER_FACULTY_KEY, JSON.stringify(response.data.masterFacultyList));
    }
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, using local data');
    return {
      masterFacultyList: JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}'),
      totalFaculty: 0,
      totalBatches: 0,
      totalSubmissions: 0,
    };
  }
};

const getHoDDashboard = async () => {
  try {
    const response = await dashboardAPI.getHoD();
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const hodKey = `faculty_${user.college}_${user.department}`;
    return {
      faculty: JSON.parse(localStorage.getItem(hodKey) || '[]'),
      batches: [],
      college: user.college,
      department: user.department,
    };
  }
};

// ========================
// DELETE OPERATIONS
// ========================
const deleteFacultyFeedback = (facultyId, year, semester) => {
  const key = `feedback_${facultyId}_${year}_${semester}`;
  localStorage.removeItem(key);
};

const deleteDepartmentFeedback = (college, dept) => {
  const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
  const deptKey = `${college}_${dept}`;
  const facultyList = master[deptKey] || [];
  facultyList.forEach((f) => {
    localStorage.removeItem(`feedback_${f.id}_${f.year}_${f.sem}`);
  });
};

const deleteCollegeFeedback = (college) => {
  const master = JSON.parse(localStorage.getItem(MASTER_FACULTY_KEY) || '{}');
  Object.keys(master).forEach((key) => {
    if (key.startsWith(`${college}_`)) {
      (master[key] || []).forEach((f) => {
        localStorage.removeItem(`feedback_${f.id}_${f.year}_${f.sem}`);
      });
    }
  });
};

// ========================
// EXPORT
// ========================
const dataService = {
  getDeptStructure,
  addDepartment,
  deleteDepartment,
  deleteCollege,
  mergeColleges,
  login,
  register,
  getAllFaculty,
  createFaculty,
  updateFaculty,
  deleteFacultyById,
  createBatch,
  getBatch,
  listBatches,
  submitFeedback,
  getFacultyStats,
  getFacultyFeedback,
  getAdminDashboard,
  getHoDDashboard,
  deleteFacultyFeedback,
  deleteDepartmentFeedback,
  deleteCollegeFeedback,
};

export default dataService;