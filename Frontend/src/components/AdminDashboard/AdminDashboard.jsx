import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import dataService from '../../services/dataService.js';
import './AdminDashboard.css';
import { generateFacultyPDF } from '../../utils/pdfGenerator';
import { generateFacultyExcel } from '../../utils/excelGenerator';

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL CONSTANTS
// ─────────────────────────────────────────────────────────────

const PARAMETERS = [
  'Knowledge of the subject',
  'Coming well prepared for the class',
  'Giving clear explanations',
  'Command of language',
  'Clear and audible voice',
  'Holding the attention of students through the class',
  'Providing more matter than in the textbooks',
  'Capability to clear the doubts of students',
  'Encouraging students to ask questions and participate',
  'Appreciating students as and when deserving',
  'Willingness to help students even out of the class',
  'Return of valued test papers/records in time',
  'Punctuality and following timetable schedule',
  'Coverage of syllabus',
  'Impartial (teaching all students alike)',
];

const YEARS = ['II', 'III', 'IV'];

const POSITIVE_KEYWORDS = [
  { keyword: 'good', label: 'Good Teaching' },
  { keyword: 'excellent', label: 'Excellent Faculty' },
  { keyword: 'helpful', label: 'Helpful Nature' },
  { keyword: 'clear', label: 'Clear Explanations' },
  { keyword: 'best', label: 'Best Faculty' },
  { keyword: 'great', label: 'Great Teaching' },
  { keyword: 'amazing', label: 'Amazing Lectures' },
  { keyword: 'well prepared', label: 'Well Prepared' },
  { keyword: 'punctual', label: 'Punctuality' },
  { keyword: 'encourage', label: 'Encouraging' },
  { keyword: 'interactive', label: 'Interactive Sessions' },
  { keyword: 'knowledgeable', label: 'Subject Knowledge' },
  { keyword: 'friendly', label: 'Approachable' },
  { keyword: 'dedicated', label: 'Dedication' },
  { keyword: 'understand', label: 'Understanding' },
];

const NEGATIVE_KEYWORDS = [
  { keyword: 'boring', label: 'Boring Lectures' },
  { keyword: 'fast', label: 'Too Fast Pace' },
  { keyword: 'unclear', label: 'Unclear Explanations' },
  { keyword: 'late', label: 'Punctuality Issues' },
  { keyword: 'not clear', label: 'Lack of Clarity' },
  { keyword: 'difficult', label: 'Difficult to Follow' },
  { keyword: 'improve', label: 'Needs Improvement' },
  { keyword: 'slow', label: 'Slow Pace' },
  { keyword: 'poor', label: 'Poor Quality' },
  { keyword: 'absent', label: 'Frequent Absence' },
  { keyword: 'rude', label: 'Rude Behavior' },
  { keyword: 'partial', label: 'Partiality' },
  { keyword: 'syllabus not', label: 'Incomplete Syllabus' },
  { keyword: 'no doubt', label: 'Doubt Clearing Issues' },
];

const FACILITY_KEYWORDS = [
  { keyword: 'lab', label: 'Lab Facilities' },
  { keyword: 'library', label: 'Library' },
  { keyword: 'wifi', label: 'WiFi/Internet' },
  { keyword: 'internet', label: 'WiFi/Internet' },
  { keyword: 'canteen', label: 'Canteen/Food' },
  { keyword: 'food', label: 'Canteen/Food' },
  { keyword: 'hostel', label: 'Hostel' },
  { keyword: 'bus', label: 'Transport' },
  { keyword: 'transport', label: 'Transport' },
  { keyword: 'parking', label: 'Parking' },
  { keyword: 'classroom', label: 'Classroom Infrastructure' },
  { keyword: 'projector', label: 'Classroom Infrastructure' },
  { keyword: 'ac ', label: 'Classroom Infrastructure' },
  { keyword: 'air condition', label: 'Classroom Infrastructure' },
  { keyword: 'toilet', label: 'Sanitation' },
  { keyword: 'washroom', label: 'Sanitation' },
  { keyword: 'restroom', label: 'Sanitation' },
  { keyword: 'playground', label: 'Sports Facilities' },
  { keyword: 'sports', label: 'Sports Facilities' },
  { keyword: 'gym', label: 'Sports Facilities' },
  { keyword: 'placement', label: 'Placements' },
  { keyword: 'internship', label: 'Internships' },
  { keyword: 'event', label: 'Events/Activities' },
  { keyword: 'fest', label: 'Events/Activities' },
  { keyword: 'club', label: 'Clubs/Societies' },
  { keyword: 'water', label: 'Basic Amenities' },
  { keyword: 'electricity', label: 'Basic Amenities' },
  { keyword: 'power cut', label: 'Basic Amenities' },
  { keyword: 'fan', label: 'Basic Amenities' },
  { keyword: 'bench', label: 'Classroom Infrastructure' },
  { keyword: 'furniture', label: 'Classroom Infrastructure' },
  { keyword: 'security', label: 'Safety/Security' },
  { keyword: 'ragging', label: 'Safety/Security' },
  { keyword: 'exam', label: 'Examination' },
  { keyword: 'result', label: 'Examination' },
  { keyword: 'fee', label: 'Fee Structure' },
  { keyword: 'scholarship', label: 'Scholarships' },
];

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL FUNCTIONS
// ─────────────────────────────────────────────────────────────

const POSITIVE_PARAM_TEMPLATES = [
  (name, param, avg) => `${name} demonstrated strong ${param.toLowerCase()} with an average rating of ${avg}/10, reflecting consistent student appreciation.`,
  (name, param, avg) => `Students rated ${name}'s ${param.toLowerCase()} highly at ${avg}/10, indicating clear satisfaction in this area.`,
  (name, param, avg) => `${name} excelled in ${param.toLowerCase()}, earning a ${avg}/10 from students.`,
];
const NEGATIVE_PARAM_TEMPLATES = [
  (name, param, avg) => `${name} was suggested to improve ${param.toLowerCase()}, which received an average of only ${avg}/10 from students.`,
  (name, param, avg) => `Students indicated that ${name}'s ${param.toLowerCase()} needs attention, with a rating of ${avg}/10.`,
  (name, param, avg) => `An improvement in ${param.toLowerCase()} is recommended for ${name}, rated at ${avg}/10 by students.`,
];
const POSITIVE_COMMENT_TEMPLATES = [
  (name, count, theme) => `${count} student${count !== 1 ? 's' : ''} positively mentioned ${name}'s ${theme}.`,
  (name, count, theme) => `Students expressed satisfaction with ${name}'s ${theme} (mentioned ${count} time${count !== 1 ? 's' : ''}).`,
];
const NEGATIVE_COMMENT_TEMPLATES = [
  (name, count, theme) => `${count} student${count !== 1 ? 's' : ''} suggested ${name} improve their ${theme}.`,
  (name, count, theme) => `Students recommended improvement in ${name}'s ${theme} (raised ${count} time${count !== 1 ? 's' : ''}).`,
];

function generateFacultySuggestions(facultyName, parameterStats, comments, totalResponses) {
  const name = facultyName || 'This faculty';
  const positives = [];
  const negatives = [];

  if (parameterStats) {
    const params = Object.entries(parameterStats)
      .map(([param, stats]) => ({ param, avg: parseFloat(stats.average) }))
      .sort((a, b) => b.avg - a.avg);
    params.filter(p => p.avg >= 8.5).slice(0, 2).forEach((p, i) => {
      positives.push(POSITIVE_PARAM_TEMPLATES[i % POSITIVE_PARAM_TEMPLATES.length](name, p.param, p.avg.toFixed(1)));
    });
    params.filter(p => p.avg < 7.0).forEach((p, i) => {
      negatives.push(NEGATIVE_PARAM_TEMPLATES[i % NEGATIVE_PARAM_TEMPLATES.length](name, p.param, p.avg.toFixed(1)));
    });
  }

  if (comments && comments.length > 0) {
    const allText = comments.filter(Boolean).join(' ').toLowerCase();
    const posThemes = {};
    const negThemes = {};
    POSITIVE_KEYWORDS.forEach(({ keyword, label }) => {
      const matches = (allText.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      if (matches > 0) posThemes[label] = (posThemes[label] || 0) + matches;
    });
    NEGATIVE_KEYWORDS.forEach(({ keyword, label }) => {
      const matches = (allText.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
      if (matches > 0) negThemes[label] = (negThemes[label] || 0) + matches;
    });
    Object.entries(posThemes).sort(([, a], [, b]) => b - a).slice(0, 3).forEach(([theme, count], i) => {
      positives.push(POSITIVE_COMMENT_TEMPLATES[i % POSITIVE_COMMENT_TEMPLATES.length](name, count, theme.toLowerCase()));
    });
    Object.entries(negThemes).sort(([, a], [, b]) => b - a).slice(0, 3).forEach(([theme, count], i) => {
      negatives.push(NEGATIVE_COMMENT_TEMPLATES[i % NEGATIVE_COMMENT_TEMPLATES.length](name, count, theme.toLowerCase()));
    });
  }

  if (positives.length === 0 && negatives.length === 0) return null;
  if (positives.length === 0) positives.push(`${name} has not received notable positive highlights in current data.`);
  if (negatives.length === 0) negatives.push(`No specific areas of concern were raised for ${name}.`);
  return { positives, negatives, rawCount: comments?.length || 0 };
}

function getParamRankings(parameterStats) {
  if (!parameterStats) return { top3: [], bottom3: [] };
  const sorted = Object.entries(parameterStats)
    .map(([param, stats]) => ({ param, avg: parseFloat(stats.average) }))
    .sort((a, b) => b.avg - a.avg);
  return {
    top3: sorted.slice(0, 3),
    bottom3: [...sorted].sort((a, b) => a.avg - b.avg).slice(0, 3),
  };
}

// ── Pure helpers — module-level (no closure needed) ──────────
function getTopParameters(parameterStats) {
  if (!parameterStats) return [];
  return Object.entries(parameterStats)
    .filter(([, stats]) => parseFloat(stats.average) > 9)
    .sort(([, a], [, b]) => parseFloat(b.average) - parseFloat(a.average))
    .slice(0, 2)
    .map(([param, stats]) => ({ parameter: param, ...stats }));
}

function getBottomParameters(parameterStats) {
  if (!parameterStats) return [];
  return Object.entries(parameterStats)
    .filter(([, stats]) => parseFloat(stats.average) < 8)
    .sort(([, a], [, b]) => parseFloat(a.average) - parseFloat(b.average))
    .map(([param, stats]) => ({ parameter: param, ...stats }));
}

// ─────────────────────────────────────────────────────────────
// TOAST COMPONENT (matches HoDDashboard)
// ─────────────────────────────────────────────────────────────
function Toast({ toast, onClose }) {
  if (!toast.show) return null;
  return (
    <div className={`hod-toast hod-toast--${toast.type}`}>
      <span className="toast-icon">
        {toast.type === 'success' ? '✅' : toast.type === 'info' ? 'ℹ️' : '⚠️'}
      </span>
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FACULTY CARD SUB-COMPONENT
// ─────────────────────────────────────────────────────────────
function FacultyCard({ faculty, onOpen, onRemove }) {
  return (
    <div className="faculty-card-compact" onClick={() => onOpen(faculty)}>
      <div className="faculty-card-header-compact">
        <span className="faculty-year-badge-compact">Y{faculty.year}</span>
        <button
          className="faculty-remove-chip"
          onClick={(e) => { e.stopPropagation(); onRemove(faculty.id, faculty.name); }}
          title="Remove faculty"
        >✕</button>
      </div>
      <h4 className="faculty-name-compact">{faculty.name}</h4>
      <p className="faculty-subject-compact">{faculty.subject}</p>
      <div className="faculty-meta-compact">
        <span>Sem {faculty.sem}</span>
        <span>Sec {faculty.sec}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, logoutUser } = useAuth();
  const isPrincipal = currentUser?.adminTitle === 'Principal' || currentUser?.userId?.startsWith('PRINCIPAL-');
  const scopedCollege = isPrincipal ? 'Gandhi' : null;

  // ── State ──────────────────────────────────────────────────
  const [allDepartments, setAllDepartments] = useState({});
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [showAIStatsModal, setShowAIStatsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiStatsDept, setAiStatsDept] = useState('');
  const [aiStatsYear, setAiStatsYear] = useState('');
  const [aiStatsBranch, setAiStatsBranch] = useState('');
  const [aiStatsData, setAiStatsData] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('current');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [deptStructure, setDeptStructureState] = useState(() => dataService.getDeptStructure());
  const [colleges, setColleges] = useState(() => {
    const struct = dataService.getDeptStructure();
    const obj = {};
    Object.keys(struct).forEach((c) => { obj[c] = c; });
    return obj;
  });

  // Faculty stats cache
  const [facultyStatsCache, setFacultyStatsCache] = useState({});
  const facultyStatsCacheRef = useRef({});
  // Keep ref in sync with state so callbacks don't go stale
  useEffect(() => { facultyStatsCacheRef.current = facultyStatsCache; }, [facultyStatsCache]);

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCollege, setNewDeptCollege] = useState('');
  const [newDeptBranches, setNewDeptBranches] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ type: '', college: '', dept: '', faculty: null });


  const [suggestionData, setSuggestionData] = useState(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState({ college: '', dept: '', faculty: '' });
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [llmSummary, setLlmSummary] = useState(null);

  const [showAdminSuggestionsView, setShowAdminSuggestionsView] = useState(false);
  const [adminSuggestionsData, setAdminSuggestionsData] = useState(null);
  const [isLoadingAdminSuggestions, setIsLoadingAdminSuggestions] = useState(false);

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const showToast = useCallback((message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4500);
  }, []);


  // ── Data loading ───────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    try {
      const dashData = await dataService.getAdminDashboard();
      if (dashData.masterFacultyList) setAllDepartments(dashData.masterFacultyList);
    } catch (e) {
      console.warn('Backend unavailable, using cached data');
      try {
        const cached = JSON.parse(localStorage.getItem('masterFacultyList') || '{}');
        setAllDepartments(cached);
      } catch (err) {
        console.error('Cache read failed:', err);
      }
    }
  }, []);

  const refreshDeptStructure = useCallback(() => {
    const struct = dataService.getDeptStructure();
    const newStruct = JSON.parse(JSON.stringify(struct || {}));
    const filtered = scopedCollege
      ? Object.fromEntries(Object.entries(newStruct).filter(([k]) => k === scopedCollege))
      : newStruct;
    setDeptStructureState(filtered);
    const obj = {};
    Object.keys(filtered).forEach((c) => { obj[c] = c; });
    setColleges(obj);
  }, [scopedCollege]);

  // ── Fixed: no facultyStatsCache in deps — reads from ref ──
  const fetchFacultyStats = useCallback(async (facultyId) => {
    if (facultyStatsCacheRef.current[facultyId]) {
      return facultyStatsCacheRef.current[facultyId];
    }
    try {
      const stats = await dataService.getFacultyStats(facultyId);
      if (stats) setFacultyStatsCache(prev => ({ ...prev, [facultyId]: stats }));
      return stats;
    } catch (e) {
      console.warn(`Failed to fetch stats for faculty ${facultyId}`);
      return null;
    }
  }, []); // stable — reads cache via ref

  const prefetchStatsForFacultyList = useCallback(async (facultyList) => {
    const updates = {};
    for (const fac of facultyList) {
      try {
        if (facultyStatsCacheRef.current[fac.id]) continue;
        const stats = await dataService.getFacultyStats(fac.id);
        if (stats) updates[fac.id] = stats;
      } catch {
        // ignore per-faculty errors
      }
    }
    if (Object.keys(updates).length > 0) {
      setFacultyStatsCache(prev => ({ ...prev, ...updates }));
    }
    return updates;
  }, []); // stable — reads cache via ref

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    loadAllData();
    refreshDeptStructure();
    const handleFocus = () => { loadAllData(); setFacultyStatsCache({}); };
    window.addEventListener('focus', handleFocus);
    return () => { window.removeEventListener('focus', handleFocus); };
  }, [currentUser, navigate, loadAllData, refreshDeptStructure]);

  // ── Handlers ───────────────────────────────────────────────
  const handleLogout = () => { logoutUser(); navigate('/', { replace: true }); };

  const openFacultyModal = useCallback(async (faculty) => {
    const stats = await fetchFacultyStats(faculty.id);
    setSelectedFaculty({
      ...faculty,
      statistics: stats,
      hasFeedback: stats ? stats.totalResponses > 0 : false,
    });
    setShowFacultyModal(true);
  }, [fetchFacultyStats]);

  const handleAddDepartment = async () => {
    if (!newDeptCollege || !newDeptName.trim()) {
      showToast('Please select a college and enter a department name.');
      return;
    }
    const branches = newDeptBranches.trim()
      ? newDeptBranches.split(',').map((b) => b.trim()).filter((b) => b)
      : null;
    const result = await dataService.addDepartment(newDeptCollege, newDeptName.trim(), branches);
    if (result.success) {
      showToast(`Department "${newDeptName.trim()}" added to ${newDeptCollege} College.`, 'success');
      refreshDeptStructure();
      setShowAddDeptModal(false);
      setNewDeptName(''); setNewDeptCollege(''); setNewDeptBranches('');
    } else {
      showToast(result.error);
    }
  };

  const handleDeleteCollege = async (college) => {
    if (!window.confirm(`🚨 DANGER! This will permanently delete "${college}" College and ALL its data.\n\nThis action CANNOT be undone.`)) return;
    if (!window.confirm(`⚠️ FINAL CONFIRMATION: Delete "${college}" College?`)) return;
    await dataService.deleteCollege(college);
    refreshDeptStructure();
    await loadAllData();
    setSelectedCollege(''); setSelectedDepartment('');
    showToast(`"${college}" College has been deleted.`, 'success');
  };

  const handleDeleteDepartment = async (college, dept) => {
    if (!window.confirm(`🗑️ Delete "${dept}" department from ${college} College?\n\nAll faculty and feedback data will be permanently removed.`)) return;
    await dataService.deleteDepartment(college, dept);
    refreshDeptStructure();
    await loadAllData();
    setSelectedDepartment('');
    showToast(`"${dept}" department deleted from ${college} College.`, 'success');
  };

    const handleDeleteResponses = (type, college, dept, faculty) => {
    setDeleteTarget({ type, college, dept, faculty });
    setShowDeleteModal(true);
  };

  const confirmDeleteResponses = async (downloadFirst) => {
    const { type, college, dept, faculty } = deleteTarget;
    if (downloadFirst && type === 'faculty' && faculty?.statistics?.totalResponses > 0) {
      generateFacultyPDF(faculty, faculty.statistics, college);
    }
    try {
      if (type === 'faculty' && faculty) await dataService.deleteFacultyFeedback(faculty.id);
      else if (type === 'department') await dataService.deleteDepartmentFeedback(college, dept);
      else if (type === 'college') await dataService.deleteCollegeFeedback(college);
      await loadAllData();
      setFacultyStatsCache({});
      setShowDeleteModal(false);
      setShowFacultyModal(false);
      showToast('Responses deleted successfully.', 'success');
    } catch (err) {
      console.error('Delete failed:', err);
      showToast(err.message || 'Failed to delete responses.');
    }
  };

  // ── Shared comment parser ──────────────────────────────────
  const parseCommentEntries = (rawData, facCode) => {
    const facComments = [];
    const generalComments = [];
    rawData.forEach((entry) => {
      if (!entry.comments) return;
      entry.comments.split(' ||| ').forEach((part) => {
        const trimmed = part.trim();
        if (trimmed.startsWith(`[FACULTY:${facCode}:`)) {
          facComments.push(trimmed.replace(/\[FACULTY:[^\]]+\]\s*/, ''));
        } else if (trimmed.startsWith('[GENERAL]')) {
          generalComments.push(trimmed.replace('[GENERAL]', '').trim());
        } else if (!trimmed.startsWith('[')) {
          facComments.push(trimmed);
        }
      });
    });
    return { facComments, generalComments };
  };

  // ── Suggestion modals ──────────────────────────────────────
  const openSuggestionModal = async (college, dept, facultyName) => {
    setSuggestionTarget({ college, dept, faculty: facultyName });
    setLlmSummary(null);
    setIsSummarizing(true);
    setSuggestionData(null);
    setShowSuggestionModal(true);

    const comments = [];
    const deptKey = `${college}_${dept}`;
    const fList = allDepartments[deptKey] || [];
    const targets = facultyName ? fList.filter((f) => f.name === facultyName) : fList;

    let parameterStats = null;
    let totalResponses = 0;

    for (const fac of targets) {
      try {
        const rawData = await dataService.getFacultyReportData(fac.id);
        if (facultyName) {
          const { facComments, generalComments } = parseCommentEntries(rawData, fac.code);
          comments.push(...facComments, ...generalComments);
          const stats = facultyStatsCacheRef.current[fac.id] || await dataService.getFacultyStats(fac.id);
          if (stats) {
            parameterStats = stats.hasSlot2 ? stats.slot2?.parameterStats : stats.slot1?.parameterStats;
            totalResponses = stats.totalResponses || 0;
          }
        } else {
          rawData.forEach((entry) => { if (entry.comments) comments.push(entry.comments); });
        }
      } catch (e) { /* skip */ }
    }

    const uniqueComments = [...new Set(comments)];
    const result = generateFacultySuggestions(facultyName, parameterStats, uniqueComments, totalResponses);
    setSuggestionData(result);
    setLlmSummary(result);
    setIsSummarizing(false);
  };

  const openAdminSuggestionsView = async (college, dept) => {
    setIsLoadingAdminSuggestions(true);
    setShowAdminSuggestionsView(true);
    setAdminSuggestionsData(null);

    const deptKey = `${college}_${dept}`;
    const fList = allDepartments[deptKey] || [];
    const facultySummaries = [];
    const allCollegeComments = [];

    for (const fac of fList) {
      try {
        const rawData = await dataService.getFacultyReportData(fac.id);
        const { facComments, generalComments } = parseCommentEntries(rawData, fac.code);
        allCollegeComments.push(...generalComments);

        let paramRankings = { top3: [], bottom3: [] };
        try {
          const stats = facultyStatsCacheRef.current[fac.id] || await dataService.getFacultyStats(fac.id);
          if (stats) {
            const paramStats = stats.hasSlot2 ? stats.slot2?.parameterStats : stats.slot1?.parameterStats;
            paramRankings = getParamRankings(paramStats);
          }
        } catch (e) { /* skip */ }

        facultySummaries.push({
          name: fac.name,
          subject: fac.subject || '',
          commentCount: facComments.length,
          paramRankings,
          suggestions: generateFacultySuggestions(
            fac.name,
            paramRankings.top3.length > 0
              ? Object.fromEntries([...paramRankings.top3, ...paramRankings.bottom3].map(p => [p.param, { average: p.avg }]))
              : null,
            [...new Set(facComments)].filter(Boolean),
            0
          ),
        });
      } catch (e) { /* skip */ }
    }

    const allCollegeText = [...new Set(allCollegeComments)].filter(Boolean);
    let collegeSummary = null;
    if (allCollegeText.length > 0) {
      const allText = allCollegeText.join(' ').toLowerCase();
      const pos = POSITIVE_KEYWORDS.filter(({ keyword }) => allText.includes(keyword)).slice(0, 3);
      const neg = NEGATIVE_KEYWORDS.filter(({ keyword }) => allText.includes(keyword)).slice(0, 3);
      collegeSummary = {
        bullet1: pos.length > 0 ? `Students appreciate ${pos.map(k => k.label).join(', ')}.` : 'No specific positive college feedback found.',
        bullet2: neg.length > 0 ? `Areas needing college attention: ${neg.map(k => k.label).join(', ')}.` : 'No major college-level concerns raised.',
      };
    }

    setAdminSuggestionsData({ facultySummaries, collegeSummary, college, dept });
    setIsLoadingAdminSuggestions(false);
  };

  // ── Helpers ────────────────────────────────────────────────
  const getRatingColor = (rating) => {
    if (rating >= 9) return '#10b981';
    if (rating >= 7) return '#3b82f6';
    if (rating >= 5) return '#f59e0b';
    if (rating >= 3) return '#f97316';
    return '#ef4444';
  };

  const getPerformanceLabel = (rating) => {
    if (rating >= 9) return 'Outstanding';
    if (rating >= 8) return 'Excellent';
    if (rating >= 7) return 'Very Good';
    if (rating >= 6) return 'Good';
    if (rating >= 5) return 'Average';
    return 'Needs Improvement';
  };

  const getFacultyByCollegeDept = useCallback((college, dept, subDept = null) => {
    const deptKey = `${college}_${dept}`;
    const deptFaculty = allDepartments[deptKey] || [];
    return deptFaculty.filter((f) => {
      const matchCollege = f.college === college;
      if (subDept && dept === 'S&H') return matchCollege && f.branch === subDept;
      return matchCollege;
    });
  }, [allDepartments]);

  const removeFaculty = async (facultyId, facultyName = 'this faculty') => {
    if (!window.confirm(`🗑️ Permanently remove "${facultyName}"?`)) return;
    try {
      await dataService.deleteFacultyById(facultyId);
      await loadAllData();
      showToast('Faculty removed successfully.', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to remove faculty.');
    }
  };

  const calculateDepartmentStats = useCallback((facultyList) => {
    if (!facultyList || facultyList.length === 0) return { avgRating: 0, satisfactionRate: 0, totalResponses: 0 };
    let totalRating = 0, totalResponses = 0, facultyWithFeedback = 0;
    facultyList.forEach((faculty) => {
      const cached = facultyStatsCache[faculty.id];
      if (cached && cached.totalResponses > 0) {
        const rating = parseFloat(cached.slot2?.overallAverage || cached.slot1?.overallAverage || 0);
        totalRating += rating;
        totalResponses += cached.totalResponses;
        facultyWithFeedback++;
      }
    });
    const avgRating = facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : 0;
    const satisfactionRate = facultyWithFeedback > 0 ? ((avgRating / 10) * 100).toFixed(1) : 0;
    return { avgRating, satisfactionRate: parseFloat(satisfactionRate), totalResponses };
  }, [facultyStatsCache]);

  const calculateCollegeStats = useCallback((college) => {
    const distribution = { Outstanding: 0, Excellent: 0, 'Very Good': 0, Good: 0, Average: 0, 'Needs Improvement': 0 };
    let totalFaculty = 0, totalResponses = 0, totalRating = 0, facultyWithFeedback = 0;
    Object.keys(deptStructure[college] || {}).forEach((dept) => {
      const deptFaculty = allDepartments[`${college}_${dept}`] || [];
      deptFaculty.forEach((faculty) => {
        totalFaculty++;
        const cached = facultyStatsCache[faculty.id];
        if (cached && cached.totalResponses > 0) {
          const rating = parseFloat(cached.slot2?.overallAverage || cached.slot1?.overallAverage || 0);
          totalRating += rating; totalResponses += cached.totalResponses; facultyWithFeedback++;
          const label = getPerformanceLabel(rating);
          if (distribution[label] !== undefined) distribution[label]++;
        }
      });
    });
    const avgRating = facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : '0.00';
    return { distribution, totalFaculty, totalResponses, avgRating };
  }, [deptStructure, allDepartments, facultyStatsCache]);

  // ── Derived / memoised ─────────────────────────────────────
  const currentDeptStructure = selectedCollege ? deptStructure[selectedCollege] || {} : {};

  const currentFaculty = useMemo(() => {
    if (!selectedCollege || !selectedDepartment) return [];
    return getFacultyByCollegeDept(selectedCollege, selectedDepartment, selectedSubDept);
  }, [selectedCollege, selectedDepartment, selectedSubDept, getFacultyByCollegeDept]);

  const filteredFaculty = useMemo(() => {
    if (!searchTerm.trim()) return currentFaculty;
    const term = searchTerm.toLowerCase();
    return currentFaculty.filter(
      (f) => f.name.toLowerCase().includes(term) || f.subject.toLowerCase().includes(term)
    );
  }, [searchTerm, currentFaculty]);

  const groupedFaculty = useMemo(() => {
    if (selectedDepartment === 'S&H') {
      const branches = currentDeptStructure['S&H'] || [];
      const grouped = {};
      branches.forEach((branch) => { grouped[branch] = filteredFaculty.filter((f) => f.branch === branch); });
      return grouped;
    }
    const grouped = {};
    YEARS.forEach((year) => { grouped[year] = filteredFaculty.filter((f) => f.year === year); });
    return grouped;
  }, [filteredFaculty, selectedDepartment, currentDeptStructure]);

  
  const generateAIStatistics = async () => {
    if (!aiStatsDept) { showToast('Please select a department first.'); return; }
    let facultyData = allDepartments[aiStatsDept] || [];
    if (aiStatsYear) facultyData = facultyData.filter((f) => f.year === aiStatsYear);
    if (facultyData.length === 0) { showToast('No faculty data for selected filters.'); return; }

    setIsGeneratingReport(true);
    try {
      await prefetchStatsForFacultyList(facultyData);
      const rows = facultyData.map((faculty) => {
        const cached = facultyStatsCacheRef.current[faculty.id];
        const s1 = cached?.slot1?.overallAverage != null ? parseFloat(cached.slot1.overallAverage) : null;
        const s2 = cached?.slot2?.overallAverage != null ? parseFloat(cached.slot2.overallAverage) : null;
        let currentRating = 0;
        if (selectedSemester === 'current') currentRating = s2 ?? s1 ?? 0;
        else if (selectedSemester === 'previous') currentRating = s1 ?? 0;
        else { if (s1 !== null && s2 !== null) currentRating = (s1 + s2) / 2; else currentRating = s2 ?? s1 ?? 0; }
        const previousRating = s1 ?? 0;
        const change = s1 !== null && s2 !== null ? (s2 - s1).toFixed(2) : null;

        let lowestParams = [];
        const slotKey = selectedSemester === 'previous' ? 'slot1' : 'slot2';
        const paramStats = cached?.[slotKey]?.parameterStats || cached?.slot1?.parameterStats;
        if (paramStats) {
          lowestParams = Object.entries(paramStats)
            .map(([param, stats]) => ({ param, avg: parseFloat(stats.average) }))
            .sort((a, b) => a.avg - b.avg).slice(0, 2);
        }

        return {
          ...faculty, slot1Avg: s1, slot2Avg: s2, change,
          currentRating: parseFloat(currentRating), previousRating: parseFloat(previousRating),
          improvement: (currentRating - previousRating).toFixed(2),
          totalResponses: cached?.totalResponses || 0,
          hasData: cached ? cached.totalResponses > 0 : false,
          lowestParams,
        };
      });

      const facultyWithData = rows.filter((r) => r.hasData);
      if (facultyWithData.length === 0) {
        setAiStatsData({ department: aiStatsDept, semester: selectedSemester, hasData: false, message: 'No feedback data for selected filters.', filters: { year: aiStatsYear || 'All', branch: aiStatsBranch || 'All' } });
        return;
      }

      const avgCurrentRating = (facultyWithData.reduce((sum, f) => sum + f.currentRating, 0) / facultyWithData.length).toFixed(2);
      const topPerformers = [...facultyWithData].filter(f => f.currentRating > 9.0).sort((a, b) => b.currentRating - a.currentRating).slice(0, 3);
      const needsImprovement = [...facultyWithData].filter(f => f.currentRating < 8.0).sort((a, b) => a.currentRating - b.currentRating);

      setAiStatsData({
        department: aiStatsDept, semester: selectedSemester, hasData: true,
        facultyStats: facultyWithData, filters: { year: aiStatsYear || 'All', branch: aiStatsBranch || 'All' },
        overall: { avgCurrentRating: parseFloat(avgCurrentRating), uniqueStudentResponses: facultyWithData.reduce((s, f) => s + f.totalResponses, 0), totalFaculty: facultyWithData.length },
        topPerformers, needsImprovement, generatedAt: new Date().toLocaleString(),
      });
    } catch (err) {
      console.error('AI Stats error:', err);
      showToast(`Failed to generate report: ${err?.message || err}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!currentUser) return null;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="dashboard-container">
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'error' })} />

      {/* ===== HEADER ===== */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-small"><span>RISE</span></div>
          <div className="header-info">
            <h2>{isPrincipal ? 'Principal Portal' : 'Admin Portal'}</h2>
            <span className="dept-badge admin">
              {isPrincipal ? '🏫 Gandhi College' : 'Global Control'}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-ai-stats" onClick={() => setShowAIStatsModal(true)}>
            <span>🤖</span> AI Statistics
          </button>
          <button className="btn-ai-stats" onClick={() => setShowAddDeptModal(true)}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <span>➕</span> Add Dept
          </button>
          {!isPrincipal && selectedCollege && (
  <button className="btn-ai-stats" onClick={() => handleDeleteCollege(selectedCollege)}
    style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
    <span>💀</span> Delete College
  </button>
)}
          <div className="user-info">
            <span className="user-icon">👑</span>
            <span className="user-name">{currentUser.username || currentUser.name}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <span>🚪</span> Logout
          </button>
        </div>
      </header>

      <main className="master-layout">
        {/* ===== SIDEBAR ===== */}
        <aside className="master-sidebar">
          <div className="sidebar-header"><h3>🏛️ Navigation</h3></div>

          <div className="sidebar-section">
            <div className="search-bar-sidebar">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search faculty..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="sidebar-section">
            <label className="sidebar-label">Select College</label>
            <select value={selectedCollege}
              onChange={(e) => { setSelectedCollege(e.target.value); setSelectedDepartment(''); setSelectedSubDept(''); }}
              className="sidebar-select">
              <option value="">Choose College</option>
              {Object.values(colleges).map((college) => (
                <option key={college} value={college}>{college}</option>
              ))}
            </select>
          </div>

          {selectedCollege && (
            <div className="sidebar-section">
              <h4 className="sidebar-heading">📚 Departments</h4>
              <ul className="sidebar-menu">
                {Object.keys(currentDeptStructure).map((deptCode) => (
                  <li key={deptCode}>
                    <button
                      className={`sidebar-menu-item ${selectedDepartment === deptCode ? 'active' : ''}`}
                      onClick={() => { setSelectedDepartment(deptCode); setSelectedSubDept(''); }}>
                      <span className="menu-icon">🏫</span>
                      <span>{deptCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedCollege && (
            <div className="sidebar-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}>
              <h4 className="sidebar-heading">⚙️ Management</h4>
              {selectedDepartment && (
                <>
                  <button className="sidebar-menu-item"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => openAdminSuggestionsView(selectedCollege, selectedDepartment)}>
                    <span className="menu-icon">💡</span> View Suggestions
                  </button>
                  <button className="sidebar-menu-item"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => handleDeleteResponses('department', selectedCollege, selectedDepartment, null)}>
                    <span className="menu-icon">🗑️</span> Delete {selectedDepartment} Responses
                  </button>
                  <button className="sidebar-menu-item"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => handleDeleteDepartment(selectedCollege, selectedDepartment)}>
                    <span className="menu-icon">❌</span> Delete {selectedDepartment} Dept
                  </button>
                </>
              )}
              {!isPrincipal && (
  <button className="sidebar-menu-item"
    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '6px' }}
    onClick={() => handleDeleteResponses('college', selectedCollege, '', null)}>
    <span className="menu-icon">🗑️</span> Delete All {selectedCollege} Responses
  </button>
)}
            </div>
          )}
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <div className="master-content">
          {!selectedCollege ? (
            <div className="analytics-dashboard">
              <div className="dashboard-welcome-header">
                <div className="welcome-icon-small">🎓</div>
                <div>
                  <h2>Admin Analytics Portal</h2>
                  <p>Real-time faculty feedback satisfaction overview</p>
                </div>
              </div>

            {/* ===== COLLEGE CARDS ===== */}
            <div
  style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '32px',
    marginTop: '48px',
    flexWrap: 'wrap',
  }}
>
  {Object.values(colleges).map((college) => {
    const collegeStats = calculateCollegeStats(college);
    const deptCount = Object.keys(deptStructure[college] || {}).length;

    return (
      <div
        key={college}
        onClick={() => setSelectedCollege(college)}
        style={{
          background: 'rgba(255,255,255,0.98)',
          borderRadius: '24px',
          padding: '36px 40px',
          minWidth: '260px',
          maxWidth: '300px',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          border: '2px solid rgba(255,107,157,0.15)',
          transition: 'all 0.3s',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px)';
          e.currentTarget.style.boxShadow = '0 16px 48px rgba(255,107,157,0.20)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.10)';
        }}
      >
        <div style={{ fontSize: '52px' }}>🏛️</div>
        <div
          style={{
            fontSize: '22px',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ff6b9d, #feca57)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {college}
        </div>
        <div style={{ fontSize: '13px', color: '#636e72', fontWeight: '600' }}>
          College
        </div>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '8px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #ffeaa7, #fed6e3)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#2d3436' }}>
              {deptCount}
            </div>
            <div style={{ fontSize: '11px', color: '#636e72', fontWeight: '600' }}>
              Depts
            </div>
          </div>
          <div
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#065f46' }}>
              {collegeStats.totalFaculty}
            </div>
            <div style={{ fontSize: '11px', color: '#065f46', fontWeight: '600' }}>
              Faculty
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: '4px',
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #ff6b9d, #feca57)',
            color: 'white',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '800',
          }}
        >
          View Details →
        </div>
      </div>
    );
  })}
          </div>

             
          ) : !selectedDepartment ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🏛️</div>
              <h2>{selectedCollege} College</h2>
              <p>Select a department from the sidebar to view faculty details</p>
            </div>
          ) : (
            <div className="department-detail-card">
              <div className="card-header-master">
                <div>
                  <h2>{selectedDepartment} Department</h2>
                  {selectedSubDept && <p className="subdept-subtitle">Managing: {selectedSubDept}</p>}
                </div>
                <span className="college-badge-master">{selectedCollege} College</span>
              </div>
              <div className="year-sections">
                {Object.entries(groupedFaculty).map(([key, faculties]) => (
                  <div key={key} className="year-section">
                    <h3 className="year-section-title">
                      {selectedDepartment === 'S&H' ? `Branch: ${key}` : `Year ${key}`}
                      <span className="faculty-count">({faculties.length})</span>
                    </h3>
                    <div className="faculty-grid-master">
                      {faculties.length === 0 ? (
                        <div className="empty-state-master">
                          <span className="empty-icon-master">🧑‍🏫</span>
                          <p>No faculty found</p>
                        </div>
                      ) : (
                        faculties.map((faculty) => (
                          <FacultyCard
                            key={faculty.id}
                            faculty={faculty}
                            onOpen={openFacultyModal}
                            onRemove={removeFaculty}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ===== FACULTY DETAIL MODAL ===== */}
      {showFacultyModal && selectedFaculty && (
        <div className="modal-overlay" onClick={() => setShowFacultyModal(false)}>
          <div className="faculty-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div className="modal-title-section">
                <h2>{selectedFaculty.name}</h2>
                <span className="modal-dept-badge">{selectedFaculty.dept}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setShowFacultyModal(false)}>✕</button>
            </div>

            <div className="modal-body-custom">
              <div className="faculty-info-grid">
                <div className="info-item">
                  <span className="info-label">Subject</span>
                  <span className="info-value">{selectedFaculty.subject}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Year</span>
                  <span className="info-value">{selectedFaculty.year}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Semester</span>
                  <span className="info-value">{selectedFaculty.sem}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Section</span>
                  <span className="info-value">{selectedFaculty.sec}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Added</span>
                  <span className="info-value">{selectedFaculty.addedDate || 'N/A'}</span>
                </div>
              </div>

              <div className="modal-action-bar">
                <button className="mab-btn mab-btn--pdf"
                  onClick={() => {
                    if (!selectedFaculty.statistics || !selectedFaculty.hasFeedback) {
                      showToast('No feedback data available for PDF.'); return;
                    }
                    generateFacultyPDF(selectedFaculty, selectedFaculty.statistics, selectedFaculty.college);
                  }}>
                  📄 Download PDF
                </button>
                <button className="mab-btn mab-btn--excel"
                  onClick={async () => {
                    if (!selectedFaculty.statistics || !selectedFaculty.hasFeedback) {
                      showToast('No feedback data available for Excel.'); return;
                    }
                    let rawData = [];
                    try { rawData = await dataService.getFacultyReportData(selectedFaculty.id); } catch (e) { /* skip */ }
                    generateFacultyExcel(selectedFaculty, rawData, selectedFaculty.statistics);
                  }}>
                  📊 Download Excel
                </button>
                <button className="mab-btn mab-btn--delete"
                  onClick={() => handleDeleteResponses('faculty', selectedFaculty.college, selectedFaculty.dept, selectedFaculty)}>
                  🗑️ Delete Responses
                </button>
                <button className="mab-btn mab-btn--suggest"
                  onClick={() => openSuggestionModal(selectedFaculty.college, selectedFaculty.dept, selectedFaculty.name)}>
                  💡 AI Suggestions
                </button>
              </div>

              {!selectedFaculty.hasFeedback || !selectedFaculty.statistics ? (
                <div className="no-feedback-message">
                  <span className="no-feedback-icon">📊</span>
                  <p>No feedback data available yet</p>
                  <p className="hint">Students need to submit feedback first</p>
                </div>
              ) : (
                <>
                  {[
                    { key: 'slot1', label: '📋 Previous Feedback Cycle', has: selectedFaculty.statistics.hasSlot1 },
                    { key: 'slot2', label: '📋 Latest Feedback Cycle', has: selectedFaculty.statistics.hasSlot2 },
                  ].map(({ key, label, has }) => {
                    if (!has) return null;
                    const slotData = selectedFaculty.statistics[key];
                    return (
                      <div key={key} className="slot-stats-section">
                        <h4 className="slot-title">
                          {label}
                          {key === 'slot2' && selectedFaculty.statistics.hasSlot1 && (() => {
                            const prev = parseFloat(selectedFaculty.statistics.slot1.overallAverage);
                            const latest = parseFloat(slotData.overallAverage);
                            const diff = (latest - prev).toFixed(2);
                            return (
                              <span style={{
                                marginLeft: '12px', padding: '4px 12px', borderRadius: '8px',
                                fontSize: '13px', fontWeight: '700',
                                background: diff > 0 ? 'rgba(16,185,129,0.15)' : diff < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#f59e0b',
                              }}>
                                {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ No Change'} from Previous
                              </span>
                            );
                          })()}
                        </h4>
                        <div className="stats-overview">
                          <div className="stat-box">
                            <span className="stat-number">
                              {slotData.responseCount}
                              {selectedFaculty?.batch?.totalStudents > 0 ? `/${selectedFaculty.batch.totalStudents}` : ''}
                            </span>
                            <span className="stat-text">Responses</span>
                          </div>
                          <div className="stat-box highlight">
                            <span className="stat-number">{slotData.overallAverage}</span>
                            <span className="stat-text">Average Rating</span>
                          </div>
                        </div>
                        <div className="rating-distribution">
                          <h4>Rating Distribution</h4>
                          {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((rating) => {
                            const count = slotData.ratingDistribution[rating] || 0;
                            const total = Object.values(slotData.ratingDistribution).reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={rating} className="rating-bar-item">
                                <span className="rating-label">⭐ {rating}</span>
                                <div className="rating-bar-bg">
                                  <div className="rating-bar-fill" style={{ width: `${percentage}%` }} />
                                </div>
                                <span className="rating-count">{percentage.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="parameter-scores">
                          <h4>Parameter Scores (All 15 Parameters)</h4>
                          {PARAMETERS.map((param) => {
                            const paramStats = slotData.parameterStats[param];
                            if (!paramStats) return null;
                            return (
                              <div key={param} className="parameter-item">
                                <span className="param-name">{param}</span>
                                <div className="param-score-bar">
                                  <div className="param-score-fill" style={{ width: `${paramStats.percentage}%` }} />
                                </div>
                                <div className="param-scores-text">
                                  <span className="param-score">{paramStats.average}/10</span>
                                  <span className="param-percentage">{paramStats.percentage}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const activeSlot = selectedFaculty.statistics.hasSlot2
                      ? selectedFaculty.statistics.slot2
                      : selectedFaculty.statistics.slot1;
                    const topParams = getTopParameters(activeSlot?.parameterStats);
                    const bottomParams = getBottomParameters(activeSlot?.parameterStats);
                    if (topParams.length === 0 && bottomParams.length === 0) return null;
                    return (
                      <>
                        <div className="excellence-section">
                          <h4 className="section-title">🌟 Areas of Excellence</h4>
                          {topParams.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>No parameters above 9.0 in this slot.</p>
                          ) : (
                            <div className="excellence-grid">
                              {topParams.map((item, idx) => (
                                <div key={item.parameter} className="excellence-card">
                                  <div className="excellence-rank">#{idx + 1}</div>
                                  <div className="excellence-content">
                                    <span className="excellence-param">{item.parameter}</span>
                                    <div className="excellence-score">
                                      <span className="score-value">{item.average}/10</span>
                                      <span className="score-percentage">{item.percentage}%</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="improvement-section">
                          <h4 className="section-title">📈 Areas of Improvement</h4>
                          {bottomParams.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '13px', padding: '8px 0' }}>No parameters below 8.0 — good performance across all areas.</p>
                          ) : (
                            <div className="improvement-grid">
                              {bottomParams.map((item, idx) => {
                                let isAreaOfConcern = false;
                                if (selectedFaculty.statistics.hasSlot1 && selectedFaculty.statistics.hasSlot2) {
                                  const prevBottom = getBottomParameters(selectedFaculty.statistics.slot1.parameterStats);
                                  isAreaOfConcern = prevBottom.some((p) => p.parameter === item.parameter);
                                }
                                return (
                                  <div key={item.parameter}
                                    className={`improvement-card ${isAreaOfConcern ? 'area-of-concern' : ''}`}
                                    style={isAreaOfConcern ? { border: '2px solid #ef4444', background: 'rgba(239,68,68,0.08)' } : {}}>
                                    <div className="improvement-rank">{isAreaOfConcern ? '🚩' : `#${idx + 1}`}</div>
                                    <div className="improvement-content">
                                      <div style={{ flex: 1 }}>
                                        <span className="improvement-param">{item.parameter}</span>
                                        {isAreaOfConcern && (
                                          <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700', marginTop: '4px' }}>
                                            🚨 Area of Concern - Needs Urgent Action
                                          </div>
                                        )}
                                      </div>
                                      <div className="improvement-score">
                                        <span className="score-value">{item.average}/10</span>
                                        <span className="score-percentage">{item.percentage}%</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="modal-footer-custom">
              <button className="btn-modal-close" onClick={() => setShowFacultyModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI STATS MODAL ===== */}
      {showAIStatsModal && (
        <div className="modal-overlay" onClick={() => setShowAIStatsModal(false)}>
          <div className="ai-stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div className="modal-title-section"><h2>🤖 AI Department Analytics</h2></div>
              <button className="modal-close-btn" onClick={() => setShowAIStatsModal(false)}>✕</button>
            </div>
            <div className="modal-body-custom ai-stats-body">
              {!aiStatsData ? (
                <div className="ai-stats-config">
                  <h3>Configure Analytics Report</h3>
                  <div className="config-section">
                    <label>Select Department</label>
                    <select value={aiStatsDept}
                      onChange={(e) => { setAiStatsDept(e.target.value); setAiStatsYear(''); setAiStatsBranch(''); }}
                      className="ai-select">
                      <option value="">Choose Department</option>
                      {Object.keys(allDepartments).map((dept) => (
                        <option key={dept} value={dept}>{dept} ({allDepartments[dept]?.length || 0} Faculty)</option>
                      ))}
                    </select>
                  </div>
                  {aiStatsDept && (
                    <div className="config-section">
                      <label>Filter by Year</label>
                      <select value={aiStatsYear} onChange={(e) => setAiStatsYear(e.target.value)} className="ai-select">
                        <option value="">All Years</option>
                        <option value="I">I Year</option>
                        <option value="II">II Year</option>
                        <option value="III">III Year</option>
                        <option value="IV">IV Year</option>
                      </select>
                    </div>
                  )}
                  <div className="config-section">
                    <label>Semester Comparison</label>
                    <div className="semester-options">
                      {['current', 'previous', 'both'].map((s) => (
                        <button key={s} className={`semester-btn ${selectedSemester === s ? 'active' : ''}`}
                          onClick={() => setSelectedSemester(s)}>
                          {s === 'current' ? 'Current' : s === 'previous' ? 'Previous' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-generate-stats" onClick={generateAIStatistics} disabled={isGeneratingReport}>
                    {isGeneratingReport ? <><span className="spinner-small" /> Analyzing...</> : <><span>🚀</span> Generate AI Report</>}
                  </button>
                </div>
              ) : (
                <div className="ai-stats-report">
                  {!aiStatsData.hasData ? (
                    <div className="no-data-message">
                      <span className="no-data-icon">📊</span>
                      <h3>No Feedback Data Available</h3>
                      <p>{aiStatsData.message}</p>
                      <button className="btn-back-config" onClick={() => setAiStatsData(null)}>← Back</button>
                    </div>
                  ) : (
                    <>
                      <div className="report-header">
                        <div className="report-title-section">
                          <h2>{aiStatsData.department} Department</h2>
                          {aiStatsData.filters && (
                            <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                              📌 Year: {aiStatsData.filters.year} | Branch: {aiStatsData.filters.branch}
                            </p>
                          )}
                          <span className="report-timestamp">Generated: {aiStatsData.generatedAt}</span>
                        </div>
                        <button className="btn-back-config" onClick={() => setAiStatsData(null)}>← Back</button>
                      </div>

                      <div className="overall-stats-grid">
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">⭐</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">{aiStatsData.overall.avgCurrentRating}</span>
                            <span className="stat-label-ai">Average Rating</span>
                          </div>
                        </div>
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">👥</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">{aiStatsData.overall.uniqueStudentResponses}</span>
                            <span className="stat-label-ai">Total Responses</span>
                          </div>
                        </div>
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">🎯</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">{getPerformanceLabel(aiStatsData.overall.avgCurrentRating)}</span>
                            <span className="stat-label-ai">Performance Level</span>
                          </div>
                        </div>
                      </div>

                      <div className="performers-section">
                        <h3>🏆 Top Performers <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>(Average above 9.0)</span></h3>
                        {aiStatsData.topPerformers.length === 0 ? (
                          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', color: '#94a3b8', textAlign: 'center', fontSize: '14px' }}>
                            No faculty has an average above 9.0 for the selected slot.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
                            {aiStatsData.topPerformers.map((faculty, idx) => (
                              <div key={faculty.id} style={{ minWidth: '200px', maxWidth: '220px', flexShrink: 0, padding: '16px', borderRadius: '14px', background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', border: '2px solid #10b981', textAlign: 'center' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#10b981', color: 'white', fontWeight: '800', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{idx + 1}</div>
                                <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>{faculty.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>{faculty.subject}</div>
                                <div style={{ fontSize: '22px', fontWeight: '900', color: '#10b981' }}>{faculty.currentRating.toFixed(2)}</div>
                                <div style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>out of 10</div>
                                <div style={{ marginTop: '8px', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${(faculty.currentRating / 10) * 100}%`, background: '#10b981', borderRadius: '4px' }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="performers-section">
                        <h3>📈 Needs Improvement <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>(Average below 8.0)</span></h3>
                        {aiStatsData.needsImprovement.length === 0 ? (
                          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', color: '#15803d', textAlign: 'center', fontSize: '14px', fontWeight: '600' }}>
                            ✅ All faculty are performing at 8.0 or above for the selected slot.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px' }}>
                            {aiStatsData.needsImprovement.map((faculty) => (
                              <div key={faculty.id} style={{ minWidth: '220px', maxWidth: '240px', flexShrink: 0, padding: '16px', borderRadius: '14px', background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '2px solid #ef4444' }}>
                                <div style={{ fontWeight: '800', fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>{faculty.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>{faculty.subject}</div>
                                <div style={{ fontSize: '22px', fontWeight: '900', color: '#ef4444' }}>{faculty.currentRating.toFixed(2)}</div>
                                <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '700', marginBottom: '10px' }}>out of 10</div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '10px' }}>
                                  <div style={{ height: '100%', width: `${(faculty.currentRating / 10) * 100}%`, background: '#ef4444', borderRadius: '4px' }} />
                                </div>
                                {faculty.lowestParams && faculty.lowestParams.length > 0 && (
                                  <div style={{ borderTop: '1px solid #fecaca', paddingTop: '8px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#b91c1c', marginBottom: '6px', textTransform: 'uppercase' }}>📌 Focus Areas</div>
                                    {faculty.lowestParams.map((p, i) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'white', borderRadius: '6px', marginBottom: '4px', fontSize: '11px' }}>
                                        <span style={{ color: '#1e293b', fontWeight: '600', flex: 1, marginRight: '6px' }}>{p.param}</span>
                                        <span style={{ fontWeight: '800', color: '#b91c1c', whiteSpace: 'nowrap' }}>{p.avg.toFixed(1)}/10</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD DEPT MODAL ===== */}
      {showAddDeptModal && (
        <div className="modal-overlay" onClick={() => setShowAddDeptModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px 0' }}>➕ Add New Department</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="sidebar-label">Select College</label>
                <select className="sidebar-select"
                  value={isPrincipal ? 'Gandhi' : newDeptCollege}
                  onChange={(e) => !isPrincipal && setNewDeptCollege(e.target.value)}
                  disabled={isPrincipal}>
                  <option value="">Choose College</option>
                  {Object.keys(colleges).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="sidebar-label">Department Name</label>
                <input type="text" className="sidebar-select" value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. CSE, ECE, MBA" />
              </div>
              <div>
                <label className="sidebar-label">Branches (Optional)</label>
                <input type="text" className="sidebar-select" value={newDeptBranches}
                  onChange={(e) => setNewDeptBranches(e.target.value)} placeholder="Comma separated (e.g., CSM, CSD)" />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleAddDepartment} className="btn-ai-stats" style={{ flex: 1 }}>✅ Save</button>
                <button onClick={() => setShowAddDeptModal(false)} className="btn-ai-stats" style={{ flex: 1, background: '#64748b' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ===== SUGGESTION MODAL ===== */}
      {showSuggestionModal && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="modal-content"
            style={{ maxWidth: '850px', width: '90%', maxHeight: '85vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <div className="modal-title-section"><h2 style={{ color: 'white' }}>💡 AI Suggestion Analysis</h2></div>
              <button className="modal-close-btn" onClick={() => setShowSuggestionModal(false)}>✕</button>
            </div>
            <div className="modal-body-custom" style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {!suggestionData ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner-small" style={{ margin: '0 auto 16px auto', width: '36px', height: '36px', borderTopColor: '#7c3aed', borderWidth: '4px' }} />
                  <h3 style={{ color: '#64748b' }}>Analyzing feedback...</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Reading ratings and comments.</p>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>
                    {suggestionTarget.faculty || `${suggestionTarget.dept} Department`}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                    Based on student ratings and {suggestionData.rawCount} comment{suggestionData.rawCount !== 1 ? 's' : ''}
                  </p>
                  <div style={{ marginBottom: '20px', padding: '18px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid #22c55e' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800', color: '#14532d' }}>✅ Positives</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e293b', fontSize: '14px', lineHeight: '2' }}>
                      {suggestionData.positives.map((p, i) => <li key={i} style={{ marginBottom: '6px' }}>{p}</li>)}
                    </ul>
                  </div>
                  <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', border: '2px solid #ef4444' }}>
                    <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800', color: '#7f1d1d' }}>⚠️ Areas to Improve</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#1e293b', fontSize: '14px', lineHeight: '2' }}>
                      {suggestionData.negatives.map((n, i) => <li key={i} style={{ marginBottom: '6px' }}>{n}</li>)}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADMIN SUGGESTIONS VIEW MODAL ===== */}
      {showAdminSuggestionsView && (
        <div className="modal-overlay" onClick={() => setShowAdminSuggestionsView(false)}>
          <div className="modal-content"
            style={{ maxWidth: '860px', width: '92%', maxHeight: '88vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column', borderRadius: '20px' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <div className="modal-title-section">
                <h2 style={{ color: 'white' }}>💡 Student Suggestions Overview</h2>
                {adminSuggestionsData && (
                  <span style={{ color: '#ddd8fe', fontSize: '14px' }}>
                    {adminSuggestionsData.dept} — {adminSuggestionsData.college} College
                  </span>
                )}
              </div>
              <button className="modal-close-btn" onClick={() => setShowAdminSuggestionsView(false)}>✕</button>
            </div>
            <div className="modal-body-custom" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              {isLoadingAdminSuggestions ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div className="spinner-small" style={{ margin: '0 auto 16px auto', width: '40px', height: '40px', borderTopColor: '#7c3aed', borderWidth: '4px' }} />
                  <h3 style={{ color: '#64748b' }}>Analyzing student suggestions...</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Filtering by keywords and building summaries.</p>
                </div>
              ) : adminSuggestionsData ? (
                <>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#1e293b', borderBottom: '3px solid #7c3aed', paddingBottom: '10px' }}>
                    🧑‍🏫 Faculty-wise Summarized Suggestions
                  </h3>
                  {adminSuggestionsData.facultySummaries.length === 0 ? (
                    <div style={{ padding: '24px', borderRadius: '14px', background: '#f8fafc', border: '2px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', marginBottom: '28px' }}>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>💬</div>
                      <p style={{ fontWeight: '700' }}>No faculty data available yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                      {adminSuggestionsData.facultySummaries.map((fac, i) => (
                        <div key={i} style={{ borderRadius: '14px', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <strong style={{ color: 'white', fontSize: '15px' }}>{fac.name}</strong>
                            {fac.subject && <span style={{ color: '#ddd8fe', fontSize: '13px', marginLeft: '4px' }}>— {fac.subject}</span>}
                          </div>
                          {(fac.paramRankings.top3.length > 0 || fac.paramRankings.bottom3.length > 0) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid #e2e8f0' }}>
                              <div style={{ padding: '14px 16px', borderRight: '2px solid #e2e8f0', background: '#f0fdf4' }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✅ Top 3 Strengths</div>
                                {fac.paramRankings.top3.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', marginBottom: '6px', background: 'white', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                    <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: '600', flex: 1 }}>{p.param}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', marginLeft: '8px', whiteSpace: 'nowrap' }}>{p.avg.toFixed(1)}/10</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ padding: '14px 16px', background: '#fef2f2' }}>
                                <div style={{ fontSize: '12px', fontWeight: '800', color: '#b91c1c', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚠️ Top 3 Needs Improvement</div>
                                {fac.paramRankings.bottom3.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', marginBottom: '6px', background: 'white', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                    <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: '600', flex: 1 }}>{p.param}</span>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#b91c1c', marginLeft: '8px', whiteSpace: 'nowrap' }}>{p.avg.toFixed(1)}/10</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {fac.suggestions && (
                            <div style={{ padding: '14px 16px', background: '#f8fafc' }}>
                              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', lineHeight: '1.9' }}>
                                {fac.suggestions.positives.slice(0, 1).map((p, i) => (
                                  <li key={`p${i}`} style={{ marginBottom: '4px', color: '#15803d' }}>{p}</li>
                                ))}
                                {fac.suggestions.negatives.slice(0, 1).map((n, i) => (
                                  <li key={`n${i}`} style={{ color: '#b91c1c' }}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ height: '3px', background: 'linear-gradient(90deg, #f59e0b, #eab308)', borderRadius: '4px', marginBottom: '28px' }} />

                  <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#1e293b', borderBottom: '3px solid #f59e0b', paddingBottom: '10px' }}>
                    🏫 College-level Summarized Suggestions
                  </h3>
                  {!adminSuggestionsData.collegeSummary ? (
                    <div style={{ padding: '24px', borderRadius: '14px', background: '#fffbeb', border: '2px dashed #fcd34d', textAlign: 'center', color: '#92400e' }}>
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏛️</div>
                      <p style={{ fontWeight: '700' }}>No college-level suggestions submitted yet.</p>
                    </div>
                  ) : (
                    <div style={{ padding: '20px 24px', borderRadius: '14px', background: 'linear-gradient(135deg, #fffbeb, #fef9c3)', border: '2px solid #f59e0b' }}>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#334155', lineHeight: '2' }}>
                        <li style={{ marginBottom: '10px' }}>
                          <strong style={{ color: '#16a34a' }}>✅ Positive Feedback: </strong>
                          {adminSuggestionsData.collegeSummary.bullet1}
                        </li>
                        <li>
                          <strong style={{ color: '#dc2626' }}>⚠️ Suggestions for College: </strong>
                          {adminSuggestionsData.collegeSummary.bullet2}
                        </li>
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content"
            style={{ maxWidth: '420px', padding: '32px', textAlign: 'center', borderRadius: '20px' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800' }}>Delete Responses?</h3>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
              Are you sure you want to delete responses for{' '}
              <strong>
                {deleteTarget.faculty ? deleteTarget.faculty.name : deleteTarget.dept ? `${deleteTarget.dept} Dept` : `${deleteTarget.college} College`}
              </strong>?
              <br />
              <span style={{ fontSize: '12px', color: '#ef4444' }}>This action cannot be undone.</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => confirmDeleteResponses(true)} className="btn-ai-stats"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', width: '100%', justifyContent: 'center' }}>
                📥 Download First, Then Delete
              </button>
              <button onClick={() => confirmDeleteResponses(false)} className="btn-ai-stats"
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', width: '100%', justifyContent: 'center' }}>
                🗑️ Delete Without Downloading
              </button>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ background: 'transparent', border: '2px solid #e2e8f0', borderRadius: '12px', color: '#64748b', cursor: 'pointer', padding: '10px', fontWeight: '700', fontSize: '14px' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <DeveloperCredit />
    </div>
  );
};

export default AdminDashboard;
