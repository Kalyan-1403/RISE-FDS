import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
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

// Moved to module level — defined once, not recreated on every analyzeSuggestions call
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

function analyzeSuggestions(comments) {
  if (!comments || comments.length === 0) {
    return {
      rawCount: 0,
      topics: [],
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      facultyComments: [],
      generalComments: [],
      facilityTopics: [],
    };
  }

  const topicMap = {};
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;
  const facultyComments = [];
  const generalComments = [];
  const facilityTopicMap = {};

  // Parse comments (split by |||)
  const allParts = [];
  comments.forEach((comment) => {
    if (!comment || typeof comment !== 'string') return;
    const parts = comment.split(' ||| ');
    parts.forEach((part) => {
      allParts.push(part.trim());
    });
  });

  // Single-pass sentiment analysis — tracks hasPositive/hasNegative
  // inline to avoid a redundant .some() re-scan after building topicMap.
  function analyzePartSentiment(text) {
    if (!text) return;
    const lower = text.toLowerCase();
    let hasPositive = false;
    let hasNegative = false;

    POSITIVE_KEYWORDS.forEach(({ keyword, label }) => {
      if (lower.includes(keyword)) {
        if (!topicMap[label])
          topicMap[label] = { text: label, count: 0, sentiment: 'positive' };
        topicMap[label].count++;
        hasPositive = true;
      }
    });

    NEGATIVE_KEYWORDS.forEach(({ keyword, label }) => {
      if (lower.includes(keyword)) {
        if (!topicMap[label])
          topicMap[label] = { text: label, count: 0, sentiment: 'negative' };
        topicMap[label].count++;
        hasNegative = true;
      }
    });

    if (!hasPositive && !hasNegative) neutralCount++;
    else if (hasPositive && !hasNegative) positiveCount++;
    else if (hasNegative && !hasPositive) negativeCount++;
    else neutralCount++;
  }

  allParts.forEach((part) => {
    if (!part) return;

    if (part.startsWith('[FACULTY:')) {
      const match = part.match(/\[FACULTY:([^:]+):([^\]]+)\]\s*(.*)/);
      if (match) {
        facultyComments.push({
          code: match[1],
          name: match[2],
          comment: match[3],
        });
        analyzePartSentiment(match[3]);
      }
    } else if (part.startsWith('[GENERAL]')) {
      const text = part.replace('[GENERAL]', '').trim();
      generalComments.push(text);
      const lower = text.toLowerCase();
      FACILITY_KEYWORDS.forEach(({ keyword, label }) => {
        if (lower.includes(keyword)) {
          if (!facilityTopicMap[label])
            facilityTopicMap[label] = { text: label, count: 0, mentions: [] };
          facilityTopicMap[label].count++;
          facilityTopicMap[label].mentions.push(text);
        }
      });
      analyzePartSentiment(text);
    } else {
      // Legacy: untagged comments
      analyzePartSentiment(part);
    }
  });

  const topics = Object.values(topicMap).sort((a, b) => b.count - a.count);
  const facilityTopics = Object.values(facilityTopicMap).sort((a, b) => b.count - a.count);

  const topPositives = topics.filter((t) => t.sentiment === 'positive').slice(0, 5);
  const topNegatives = topics.filter((t) => t.sentiment === 'negative').slice(0, 8);

  // RED ZONE detection (urgent attention)
  const redZone = [];
  const RED_NEGATIVE_TRIGGERS = [
    'rude', 'partial', 'ragging', 'unsafe', 'harassment',
    'boring', 'unclear', 'not clear', 'no doubt',
    'syllabus not', 'absent', 'poor',
  ];
  const joinedText = allParts.join(' ').toLowerCase();
  RED_NEGATIVE_TRIGGERS.forEach((k) => {
    if (joinedText.includes(k)) {
      redZone.push({ type: 'teaching', label: `High concern keyword: "${k}"` });
    }
  });
  facilityTopics.forEach((t) => {
    if (t.count >= 3) {
      redZone.push({
        type: 'facility',
        label: `Frequent facility complaint: ${t.text} (${t.count})`,
      });
    }
  });

  const summary = [
    `Analyzed ${allParts.length} comment lines.`,
    topPositives.length
      ? `Top positives: ${topPositives.map((t) => `${t.text} (${t.count})`).join(', ')}.`
      : `Top positives: none detected.`,
    topNegatives.length
      ? `Top complaints: ${topNegatives.map((t) => `${t.text} (${t.count})`).join(', ')}.`
      : `Top complaints: none detected.`,
    redZone.length
      ? `Red zone items detected: ${redZone.length}.`
      : `No red zone items detected.`,
  ].join(' ');

  return {
    rawCount: allParts.length,
    topics,
    positiveCount,
    negativeCount,
    neutralCount,
    facultyComments,
    generalComments,
    facilityTopics,
    topPositives,
    topNegatives,
    redZone,
    summary,
  };
}

function generateKeywordSummary(comments) {
  if (!comments || comments.length === 0) return null;
  const allText = comments.filter(Boolean).join(' ').toLowerCase();
  const positiveMatched = POSITIVE_KEYWORDS.filter(({ keyword }) => allText.includes(keyword));
  const negativeMatched = NEGATIVE_KEYWORDS.filter(({ keyword }) => allText.includes(keyword));
  if (positiveMatched.length === 0 && negativeMatched.length === 0) return null;
  const bullet1 =
    positiveMatched.length > 0
      ? `Students appreciate ${positiveMatched.slice(0, 3).map((k) => k.label).join(', ')}.`
      : 'No specific positive aspects were highlighted by students.';
  const bullet2 =
    negativeMatched.length > 0
      ? `Areas needing improvement: ${negativeMatched.slice(0, 3).map((k) => k.label).join(', ')}.`
      : 'No major concerns or improvement areas raised.';
  return { bullet1, bullet2 };
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, logoutUser } = useAuth();

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

  // Faculty stats cache (fetched from backend)
  const [facultyStatsCache, setFacultyStatsCache] = useState({});

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCollege, setNewDeptCollege] = useState('');
  const [newDeptBranches, setNewDeptBranches] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({
    type: '',
    college: '',
    dept: '',
    faculty: null,
  });

  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonCollege, setComparisonCollege] = useState('');
  const [comparisonDept, setComparisonDept] = useState('');

  const [suggestionData, setSuggestionData] = useState(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState({
    college: '',
    dept: '',
    faculty: '',
  });
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [llmSummary, setLlmSummary] = useState(null);

  const [showAdminSuggestionsView, setShowAdminSuggestionsView] = useState(false);
  const [adminSuggestionsData, setAdminSuggestionsData] = useState(null);
  const [isLoadingAdminSuggestions, setIsLoadingAdminSuggestions] = useState(false);

  // ── Data loading ───────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    try {
      const dashData = await dataService.getAdminDashboard();
      if (dashData.masterFacultyList) {
        setAllDepartments(dashData.masterFacultyList);
      }
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
    setDeptStructureState(newStruct);
    const obj = {};
    Object.keys(newStruct).forEach((c) => { obj[c] = c; });
    setColleges(obj);
  }, []);

  // Fetch faculty stats from backend
  const fetchFacultyStats = useCallback(
    async (facultyId) => {
      if (facultyStatsCache[facultyId]) {
        return facultyStatsCache[facultyId];
      }
      try {
        const stats = await dataService.getFacultyStats(facultyId);
        if (stats) {
          setFacultyStatsCache((prev) => ({ ...prev, [facultyId]: stats }));
        }
        return stats;
      } catch (e) {
        console.warn(`Failed to fetch stats for faculty ${facultyId}`);
        return null;
      }
    },
    [facultyStatsCache]
  );

  const prefetchStatsForFacultyList = useCallback(
    async (facultyList) => {
      const updates = {};
      for (const fac of facultyList) {
        try {
          if (facultyStatsCache[fac.id]) continue;
          const stats = await dataService.getFacultyStats(fac.id);
          if (stats) updates[fac.id] = stats;
        } catch {
          // ignore per-faculty errors
        }
      }
      if (Object.keys(updates).length > 0) {
        setFacultyStatsCache((prev) => ({ ...prev, ...updates }));
      }
      return updates;
    },
    [facultyStatsCache]
  );

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    loadAllData();
    refreshDeptStructure();

    const handleFocus = () => {
      loadAllData();
      setFacultyStatsCache({});
    };
    window.addEventListener('focus', handleFocus);
    return () => { window.removeEventListener('focus', handleFocus); };
  }, [currentUser, navigate, loadAllData, refreshDeptStructure]);

  // ── Handlers ───────────────────────────────────────────────
  const handleLogout = () => {
    logoutUser();
    navigate('/', { replace: true });
  };

  const openFacultyModal = useCallback(
    async (faculty) => {
      const stats = await fetchFacultyStats(faculty.id);
      setSelectedFaculty({
        ...faculty,
        statistics: stats,
        hasFeedback: stats ? stats.totalResponses > 0 : false,
      });
      setShowFacultyModal(true);
    },
    [fetchFacultyStats]
  );

  const getTopParameters = (parameterStats, count = 3) => {
    if (!parameterStats) return [];
    return Object.entries(parameterStats)
      .sort(([, a], [, b]) => parseFloat(b.average) - parseFloat(a.average))
      .slice(0, count)
      .map(([param, stats]) => ({ parameter: param, ...stats }));
  };

  const getBottomParameters = (parameterStats, count = 3) => {
    if (!parameterStats) return [];
    return Object.entries(parameterStats)
      .sort(([, a], [, b]) => parseFloat(a.average) - parseFloat(b.average))
      .slice(0, count)
      .map(([param, stats]) => ({ parameter: param, ...stats }));
  };

  const handleAddDepartment = async () => {
    if (!newDeptCollege || !newDeptName.trim()) {
      alert('⚠️ Please select a college and enter department name');
      return;
    }
    const branches = newDeptBranches.trim()
      ? newDeptBranches.split(',').map((b) => b.trim()).filter((b) => b)
      : null;
    const result = await dataService.addDepartment(newDeptCollege, newDeptName.trim(), branches);
    if (result.success) {
      alert(`✅ Department "${newDeptName.trim()}" added to ${newDeptCollege} College!`);
      refreshDeptStructure();
      setShowAddDeptModal(false);
      setNewDeptName('');
      setNewDeptCollege('');
      setNewDeptBranches('');
    } else {
      alert(`⚠️ ${result.error}`);
    }
  };

  const handleDeleteCollege = async (college) => {
    if (!window.confirm(
      `🚨 DANGER! This will permanently delete "${college}" College and ALL its data.\n\nThis action CANNOT be undone.`
    )) return;
    if (!window.confirm(`⚠️ FINAL CONFIRMATION: Delete "${college}" College?`)) return;
    await dataService.deleteCollege(college);
    refreshDeptStructure();
    await loadAllData();
    setSelectedCollege('');
    setSelectedDepartment('');
    alert(`✅ "${college}" College has been deleted.`);
  };

  const handleDeleteDepartment = async (college, dept) => {
    if (!window.confirm(
      `🗑️ Delete "${dept}" department from ${college} College?\n\nAll faculty and feedback data will be permanently removed.`
    )) return;
    await dataService.deleteDepartment(college, dept);
    refreshDeptStructure();
    await loadAllData();
    setSelectedDepartment('');
    alert(`✅ "${dept}" department deleted from ${college} College.`);
  };

  const handleMergeColleges = () => {
    const collegeList = Object.keys(deptStructure);
    if (collegeList.length < 2) {
      alert('⚠️ Need at least 2 colleges to merge');
      return;
    }
    const source = prompt(
      `Enter the college to MERGE FROM (will be deleted):\nAvailable: ${collegeList.join(', ')}`
    );
    if (!source || !collegeList.includes(source)) return;
    const target = prompt(
      `Enter the college to MERGE INTO (will keep):\nAvailable: ${collegeList.filter((c) => c !== source).join(', ')}`
    );
    if (!target || !collegeList.includes(target) || target === source) return;
    if (!window.confirm(`🔄 Merge "${source}" INTO "${target}"?\n\n"${source}" will be deleted after merge.`)) return;
    const result = dataService.mergeColleges(source, target);
    if (result.success) {
      refreshDeptStructure();
      loadAllData();
      setSelectedCollege('');
      alert(`✅ "${source}" has been merged into "${target}".`);
    } else {
      alert(`⚠️ ${result.error}`);
    }
  };

  const handleDeleteResponses = (type, college, dept, faculty) => {
    setDeleteTarget({ type, college, dept, faculty });
    setShowDeleteModal(true);
  };

  const confirmDeleteResponses = async (downloadFirst) => {
    const { type, college, dept, faculty } = deleteTarget;
    if (downloadFirst) {
      if (
        type === 'faculty' &&
        faculty &&
        faculty.statistics &&
        faculty.statistics.totalResponses > 0
      ) {
        generateFacultyPDF(faculty, faculty.statistics, college);
      }
    }
    try {
      if (type === 'faculty' && faculty) {
        await dataService.deleteFacultyFeedback(faculty.id);
      } else if (type === 'department') {
        await dataService.deleteDepartmentFeedback(college, dept);
      } else if (type === 'college') {
        await dataService.deleteCollegeFeedback(college);
      }
      await loadAllData();
      setFacultyStatsCache({});
      setShowDeleteModal(false);
      setShowFacultyModal(false);
      alert('✅ Responses deleted successfully!');
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`⚠️ ${err.message || 'Failed to delete responses'}`);
    }
  };

  // ── Shared comment parser ──────────────────────────────────
  // Eliminates duplicated parsing logic between openSuggestionModal
  // and openAdminSuggestionsView.
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

    for (const fac of targets) {
      try {
        const rawData = await dataService.getFacultyReportData(fac.id);
        if (facultyName) {
          const { facComments, generalComments } = parseCommentEntries(rawData, fac.code);
          comments.push(...facComments, ...generalComments);
        } else {
          rawData.forEach((entry) => {
            if (entry.comments) comments.push(entry.comments);
          });
        }
      } catch (e) {
        // Skip failed faculty
      }
    }

    const uniqueComments = [...new Set(comments)];
    setSuggestionData(analyzeSuggestions(uniqueComments));

    const targetLabel = facultyName ? facultyName : `${dept} Department`;
    setLlmSummary(summaryResult);
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

        const unique = [...new Set(facComments)].filter(Boolean);
        if (unique.length > 0) {
          facultySummaries.push({
            name: fac.name,
            code: fac.code,
            summary: generateKeywordSummary(unique),
            commentCount: unique.length,
          });
        }
      } catch (e) {
        // Skip failed faculty
      }
    }

    const uniqueCollegeComments = [...new Set(allCollegeComments)].filter(Boolean);
    const collegeSummary = generateKeywordSummary(uniqueCollegeComments);

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

  const getFacultyByCollegeDept = useCallback(
    (college, dept, subDept = null) => {
      const deptKey = `${college}_${dept}`;
      const deptFaculty = allDepartments[deptKey] || [];
      return deptFaculty.filter((f) => {
        const matchCollege = f.college === college;
        if (subDept && dept === 'S&H') return matchCollege && f.branch === subDept;
        return matchCollege;
      });
    },
    [allDepartments]
  );

  // removeFaculty — deptKey param removed (was unused)
  const removeFaculty = async (facultyId, facultyName = 'this faculty') => {
    if (!window.confirm(`🗑️ Permanently remove "${facultyName}"?`)) return;
    try {
      await dataService.deleteFacultyById(facultyId);
      await loadAllData();
      alert('✅ Faculty removed successfully!');
    } catch (e) {
      alert(`⚠️ ${e.message || 'Failed to remove faculty.'}`);
    }
  };

  const calculateDepartmentStats = useCallback(
    (facultyList) => {
      if (!facultyList || facultyList.length === 0)
        return { avgRating: 0, satisfactionRate: 0, totalResponses: 0 };

      let totalRating = 0;
      let totalResponses = 0;
      let facultyWithFeedback = 0;

      facultyList.forEach((faculty) => {
        const cached = facultyStatsCache[faculty.id];
        if (cached && cached.totalResponses > 0) {
          const rating = parseFloat(
            cached.slot2?.overallAverage || cached.slot1?.overallAverage || 0
          );
          totalRating += rating;
          totalResponses += cached.totalResponses;
          facultyWithFeedback++;
        }
      });

      const avgRating =
        facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : 0;
      const satisfactionRate =
        facultyWithFeedback > 0 ? ((avgRating / 10) * 100).toFixed(1) : 0;
      return {
        avgRating,
        satisfactionRate: parseFloat(satisfactionRate),
        totalResponses,
      };
    },
    [facultyStatsCache]
  );

  const calculateCollegeStats = useCallback(
    (college) => {
      const distribution = {
        Outstanding: 0,
        Excellent: 0,
        'Very Good': 0,
        Good: 0,
        Average: 0,
        'Needs Improvement': 0,
      };
      let totalFaculty = 0;
      let totalResponses = 0;
      let totalRating = 0;
      let facultyWithFeedback = 0;

      Object.keys(deptStructure[college] || {}).forEach((dept) => {
        const deptKey = `${college}_${dept}`;
        const deptFaculty = allDepartments[deptKey] || [];
        deptFaculty.forEach((faculty) => {
          totalFaculty++;
          const cached = facultyStatsCache[faculty.id];
          if (cached && cached.totalResponses > 0) {
            const rating = parseFloat(
              cached.slot2?.overallAverage || cached.slot1?.overallAverage || 0
            );
            totalRating += rating;
            totalResponses += cached.totalResponses;
            facultyWithFeedback++;
            const label = getPerformanceLabel(rating);
            if (distribution[label] !== undefined) distribution[label]++;
          }
        });
      });

      const avgRating =
        facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : '0.00';
      return { distribution, totalFaculty, totalResponses, avgRating };
    },
    [deptStructure, allDepartments, facultyStatsCache]
  );

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
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.code.toLowerCase().includes(term) ||
        f.subject.toLowerCase().includes(term)
    );
  }, [searchTerm, currentFaculty]);

  const groupedFaculty = useMemo(() => {
    if (selectedDepartment === 'S&H') {
      const branches = currentDeptStructure['S&H'] || [];
      const grouped = {};
      branches.forEach((branch) => {
        grouped[branch] = filteredFaculty.filter((f) => f.branch === branch);
      });
      return grouped;
    } else {
      const grouped = {};
      YEARS.forEach((year) => {
        grouped[year] = filteredFaculty.filter((f) => f.year === year);
      });
      return grouped;
    }
  }, [filteredFaculty, selectedDepartment, currentDeptStructure]);

  const getComparisonData = useCallback(() => {
    if (!comparisonCollege || !comparisonDept) return [];
    const deptKey = `${comparisonCollege}_${comparisonDept}`;
    const facultyList = allDepartments[deptKey] || [];
    return facultyList
      .map((faculty) => {
        const cached = facultyStatsCache[faculty.id];
        return {
          ...faculty,
          slot1Avg: cached?.slot1?.overallAverage || null,
          slot2Avg: cached?.slot2?.overallAverage || null,
          change:
            cached?.slot1 && cached?.slot2
              ? (
                  parseFloat(cached.slot2.overallAverage) -
                  parseFloat(cached.slot1.overallAverage)
                ).toFixed(2)
              : null,
          hasData: cached ? cached.totalResponses > 0 : false,
        };
      })
      .filter((f) => f.hasData);
  }, [comparisonCollege, comparisonDept, allDepartments, facultyStatsCache]);

  const generateAIStatistics = async () => {
    if (!aiStatsDept) {
      alert('⚠️ Please select a department first!');
      return;
    }

    let facultyData = allDepartments[aiStatsDept] || [];
    if (aiStatsYear) facultyData = facultyData.filter((f) => f.year === aiStatsYear);
    if (aiStatsBranch) facultyData = facultyData.filter((f) => f.branch === aiStatsBranch);

    if (facultyData.length === 0) {
      alert('⚠️ No faculty data for selected filters!');
      return;
    }

    setIsGeneratingReport(true);

    try {
      await prefetchStatsForFacultyList(facultyData);

      const rows = facultyData.map((faculty) => {
        const cached = facultyStatsCache[faculty.id];
        const s1 =
          cached?.slot1?.overallAverage != null
            ? parseFloat(cached.slot1.overallAverage)
            : null;
        const s2 =
          cached?.slot2?.overallAverage != null
            ? parseFloat(cached.slot2.overallAverage)
            : null;
        const currentRating = s2 ?? s1 ?? 0;
        const previousRating = s1 ?? 0;
        const change = s1 !== null && s2 !== null ? (s2 - s1).toFixed(2) : null;
        return {
          ...faculty,
          slot1Avg: s1,
          slot2Avg: s2,
          change,
          currentRating: parseFloat(currentRating),
          previousRating: parseFloat(previousRating),
          improvement: (currentRating - previousRating).toFixed(2),
          totalResponses: cached?.totalResponses || 0,
          hasData: cached ? cached.totalResponses > 0 : false,
        };
      });

      const facultyWithData = rows.filter((r) => r.hasData);

      if (facultyWithData.length === 0) {
        setAiStatsData({
          department: aiStatsDept,
          semester: selectedSemester,
          hasData: false,
          message: 'No feedback data for selected filters.',
          filters: { year: aiStatsYear || 'All', branch: aiStatsBranch || 'All' },
        });
        return;
      }

      const avgCurrentRating = (
        facultyWithData.reduce((sum, f) => sum + f.currentRating, 0) / facultyWithData.length
      ).toFixed(2);
      const topPerformers = [...facultyWithData]
        .sort((a, b) => b.currentRating - a.currentRating)
        .slice(0, 3);
      const needsImprovement = [...facultyWithData]
        .sort((a, b) => a.currentRating - b.currentRating)
        .slice(0, 3);

      setAiStatsData({
        department: aiStatsDept,
        semester: selectedSemester,
        hasData: true,
        facultyStats: facultyWithData,
        filters: { year: aiStatsYear || 'All', branch: aiStatsBranch || 'All' },
        overall: {
          avgCurrentRating: parseFloat(avgCurrentRating),
          uniqueStudentResponses: facultyWithData.reduce((s, f) => s + f.totalResponses, 0),
          totalFaculty: facultyWithData.length,
        },
        topPerformers,
        needsImprovement,
        generatedAt: new Date().toLocaleString(),
      });
    } catch (err) {
      console.error('AI Stats error:', err);
      alert(`⚠️ Failed to generate report: ${err?.message || err}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!currentUser) return null;

  // ── Faculty card renderer ──────────────────────────────────
  const renderFacultyCard = (faculty) => (
    <div
      key={faculty.id}
      className="faculty-card-compact"
      onClick={() => openFacultyModal(faculty)}
    >
      <div className="faculty-card-header-compact">
        <span className="faculty-code-badge-compact">{faculty.code}</span>
        <span className="faculty-year-badge-compact">Y{faculty.year}</span>
        <button
          className="faculty-remove-chip"
          onClick={(e) => {
            e.stopPropagation();
            removeFaculty(faculty.id, faculty.name);
          }}
          title="Remove faculty"
        >
          ✕
        </button>
      </div>
      <h4 className="faculty-name-compact">{faculty.name}</h4>
      <p className="faculty-subject-compact">{faculty.subject}</p>
      <div className="faculty-meta-compact">
        <span>Sem {faculty.sem}</span>
        <span>Sec {faculty.sec}</span>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="dashboard-container">
      {/* ===== HEADER ===== */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-small">
            <span>RISE</span>
          </div>
          <div className="header-info">
            <h2>Master Admin Portal</h2>
            <span className="dept-badge admin">Global Control</span>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-ai-stats" onClick={() => setShowAIStatsModal(true)}>
            <span>🤖</span> AI Statistics
          </button>
          <button
            className="btn-ai-stats"
            onClick={() => setShowComparisonModal(true)}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          >
            <span>📊</span> Compare
          </button>
          <button
            className="btn-ai-stats"
            onClick={() => setShowAddDeptModal(true)}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            <span>➕</span> Add Dept
          </button>
          <button
            className="btn-ai-stats"
            onClick={handleMergeColleges}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <span>🔄</span> Merge
          </button>
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
          <div className="sidebar-header">
            <h3>🏛️ Navigation</h3>
          </div>

          <div className="sidebar-section">
            <div className="search-bar-sidebar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search faculty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="sidebar-section">
            <label className="sidebar-label">Select College</label>
            <select
              value={selectedCollege}
              onChange={(e) => {
                setSelectedCollege(e.target.value);
                setSelectedDepartment('');
                setSelectedSubDept('');
              }}
              className="sidebar-select"
            >
              <option value="">Choose College</option>
              {Object.values(colleges).map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
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
                      onClick={() => {
                        setSelectedDepartment(deptCode);
                        setSelectedSubDept('');
                      }}
                    >
                      <span className="menu-icon">🏫</span>
                      <span>{deptCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedCollege && (
            <div
              className="sidebar-section"
              style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}
            >
              <h4 className="sidebar-heading">⚙️ Management</h4>
              {selectedDepartment && (
                <>
                  <button
                    className="sidebar-menu-item"
                    style={{
                      background: 'rgba(139,92,246,0.1)',
                      color: '#7c3aed',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                    onClick={() => openAdminSuggestionsView(selectedCollege, selectedDepartment)}
                  >
                    <span className="menu-icon">💡</span>{' '}
                    View Suggestions
                  </button>
                  <button
                    className="sidebar-menu-item"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                    onClick={() =>
                      handleDeleteResponses('department', selectedCollege, selectedDepartment, null)
                    }
                  >
                    <span className="menu-icon">🗑️</span>{' '}
                    Delete {selectedDepartment} Responses
                  </button>
                  <button
                    className="sidebar-menu-item"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      color: '#dc2626',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                    onClick={() => handleDeleteDepartment(selectedCollege, selectedDepartment)}
                  >
                    <span className="menu-icon">❌</span>{' '}
                    Delete {selectedDepartment} Dept
                  </button>
                </>
              )}
              <button
                className="sidebar-menu-item"
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  color: '#ef4444',
                  fontSize: '12px',
                  marginBottom: '6px',
                }}
                onClick={() => handleDeleteResponses('college', selectedCollege, '', null)}
              >
                <span className="menu-icon">🗑️</span>{' '}
                Delete All {selectedCollege} Responses
              </button>
              <button
                className="sidebar-menu-item"
                style={{
                  background: 'rgba(239,68,68,0.2)',
                  color: '#b91c1c',
                  fontSize: '12px',
                }}
                onClick={() => handleDeleteCollege(selectedCollege)}
              >
                <span className="menu-icon">💀</span>{' '}
                Delete {selectedCollege} College
              </button>
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
                  <h2>Master Admin Analytics Portal</h2>
                  <p>Real-time faculty feedback satisfaction overview</p>
                </div>
              </div>

              <div className="college-analytics-grid">
                {Object.values(colleges).map((college) => {
                  const collegeData = Object.keys(deptStructure[college] || {}).map((dept) => {
                    const deptKey = `${college}_${dept}`;
                    const deptFaculty = allDepartments[deptKey] || [];
                    const stats = calculateDepartmentStats(deptFaculty);
                    return {
                      dept,
                      avgRating: parseFloat(stats.avgRating),
                      satisfactionRate: stats.satisfactionRate,
                      totalResponses: stats.totalResponses,
                      facultyCount: deptFaculty.length,
                    };
                  });
                  const maxRating = 10.0;

                  return (
                    <div key={college} className="college-analytics-card">
                      <div className="college-card-header">
                        <h3>🏛️ {college} College</h3>
                        <button
                          className="btn-view-college"
                          onClick={() => setSelectedCollege(college)}
                        >
                          View Details →
                        </button>
                      </div>
                      <div className="mathematical-chart">
                        <div className="chart-title">Department Satisfaction Graph</div>
                        <div className="chart-container">
                          <div className="y-axis">
                            <div className="y-axis-label">Rating</div>
                            <div className="y-axis-ticks">
                              {[10, 8, 6, 4, 2, 0].map((tick) => (
                                <div key={tick} className="y-tick">
                                  <span className="y-tick-label">{tick.toFixed(1)}</span>
                                  <span className="y-tick-line"></span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="chart-area">
                            <div className="chart-grid">
                              {[10, 8, 6, 4, 2].map((line) => (
                                <div
                                  key={line}
                                  className="grid-line"
                                  style={{ bottom: `${(line / maxRating) * 100}%` }}
                                />
                              ))}
                            </div>
                            <div className="chart-bars">
                              {collegeData.map((data, index) => (
                                <div key={data.dept} className="bar-wrapper">
                                  <div className="bar-container">
                                    <div
                                      className="bar-fill"
                                      style={{
                                        height: `${(data.avgRating / maxRating) * 100}%`,
                                        backgroundColor: getRatingColor(data.avgRating),
                                        animationDelay: `${index * 0.1}s`,
                                      }}
                                    >
                                      <span className="bar-value">{data.avgRating}</span>
                                    </div>
                                  </div>
                                  <div className="bar-info">
                                    <span className="bar-dept">{data.dept}</span>
                                    <span className="bar-responses">{data.totalResponses}R</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="x-axis">
                          <div className="x-axis-label">Departments</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="college-pie-charts-section">
                <h3>📊 Performance Distribution by College</h3>
                <div className="pie-charts-grid">
                  {Object.values(colleges).map((college) => {
                    const collegeStats = calculateCollegeStats(college);
                    return (
                      <div key={college} className="college-pie-card">
                        <div className="pie-card-header">
                          <h4>{college} College</h4>
                          <div className="pie-card-summary">
                            <span className="pie-summary-item">
                              👥 {collegeStats.totalFaculty} Faculty
                            </span>
                            <span className="pie-summary-item">
                              ⭐ {collegeStats.avgRating}/10 Avg
                            </span>
                          </div>
                        </div>
                        <div className="pie-chart-visual">
                          {[
                            { label: 'Outstanding', color: '#10b981', emoji: '🌟' },
                            { label: 'Excellent', color: '#3b82f6', emoji: '⭐' },
                            { label: 'Very Good', color: '#6366f1', emoji: '👍' },
                            { label: 'Good', color: '#f59e0b', emoji: '👌' },
                            { label: 'Average', color: '#f97316', emoji: '📈' },
                            { label: 'Needs Improvement', color: '#ef4444', emoji: '📉' },
                          ].map((category) => {
                            const count = collegeStats.distribution[category.label] || 0;
                            const percentage =
                              collegeStats.totalFaculty > 0
                                ? ((count / collegeStats.totalFaculty) * 100).toFixed(1)
                                : 0;
                            return (
                              <div key={category.label} className="pie-segment-item">
                                <div className="pie-segment-header">
                                  <span className="pie-emoji">{category.emoji}</span>
                                  <span className="pie-label">{category.label}</span>
                                </div>
                                <div className="pie-bar-container">
                                  <div
                                    className="pie-bar-fill"
                                    style={{
                                      width: `${percentage}%`,
                                      backgroundColor: category.color,
                                    }}
                                  />
                                </div>
                                <div className="pie-segment-stats">
                                  <span>{count} faculty</span>
                                  <span className="percentage-badge">{percentage}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="pie-card-footer">
                          📝 Total Responses: {collegeStats.totalResponses}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  {selectedSubDept && (
                    <p className="subdept-subtitle">Managing: {selectedSubDept}</p>
                  )}
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
                        faculties.map(renderFacultyCard)
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
              <button className="modal-close-btn" onClick={() => setShowFacultyModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body-custom">
              <div className="faculty-info-grid">
                <div className="info-item">
                  <span className="info-label">Code</span>
                  <span className="info-value">{selectedFaculty.code}</span>
                </div>
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

              <div
                style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}
              >
                <button
                  onClick={() => {
                    if (!selectedFaculty.statistics || !selectedFaculty.hasFeedback) {
                      alert('⚠️ No feedback data available for PDF.');
                      return;
                    }
                    generateFacultyPDF(selectedFaculty, selectedFaculty.statistics, selectedFaculty.college);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  📄 Download PDF
                </button>
                <button
                  onClick={async () => {
                    if (!selectedFaculty.statistics || !selectedFaculty.hasFeedback) {
                      alert('⚠️ No feedback data available for Excel.');
                      return;
                    }
                    let rawData = [];
                    try {
                      rawData = await dataService.getFacultyReportData(selectedFaculty.id);
                    } catch (e) {
                      console.warn('Raw data unavailable');
                    }
                    generateFacultyExcel(selectedFaculty, rawData, selectedFaculty.statistics);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  📊 Download Excel
                </button>
                <button
                  onClick={() =>
                    handleDeleteResponses(
                      'faculty',
                      selectedFaculty.college,
                      selectedFaculty.dept,
                      selectedFaculty
                    )
                  }
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  🗑️ Delete Responses
                </button>
                <button
                  onClick={() =>
                    openSuggestionModal(
                      selectedFaculty.college,
                      selectedFaculty.dept,
                      selectedFaculty.name
                    )
                  }
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
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
                          {key === 'slot2' &&
                            selectedFaculty.statistics.hasSlot1 &&
                            (() => {
                              const prev = parseFloat(
                                selectedFaculty.statistics.slot1.overallAverage
                              );
                              const latest = parseFloat(slotData.overallAverage);
                              const diff = (latest - prev).toFixed(2);
                              return (
                                <span
                                  style={{
                                    marginLeft: '12px',
                                    padding: '4px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    background:
                                      diff > 0
                                        ? 'rgba(16,185,129,0.15)'
                                        : diff < 0
                                        ? 'rgba(239,68,68,0.15)'
                                        : 'rgba(245,158,11,0.15)',
                                    color:
                                      diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#f59e0b',
                                  }}
                                >
                                  {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ No Change'}{' '}
                                  from Previous
                                </span>
                              );
                            })()}
                        </h4>
                        <div className="stats-overview">
                          <div className="stat-box">
                            <span className="stat-number">{slotData.responseCount}</span>
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
                            const total = Object.values(slotData.ratingDistribution).reduce(
                              (a, b) => a + b,
                              0
                            );
                            const percentage = total > 0 ? (count / total) * 100 : 0;
                            return (
                              <div key={rating} className="rating-bar-item">
                                <span className="rating-label">⭐ {rating}</span>
                                <div className="rating-bar-bg">
                                  <div
                                    className="rating-bar-fill"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="rating-count">{count}</span>
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
                                  <div
                                    className="param-score-fill"
                                    style={{ width: `${paramStats.percentage}%` }}
                                  />
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
                    if (topParams.length === 0) return null;
                    return (
                      <>
                        <div className="excellence-section">
                          <h4 className="section-title">🌟 Areas of Excellence</h4>
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
                        </div>
                        <div className="improvement-section">
                          <h4 className="section-title">📈 Areas of Improvement</h4>
                          <div className="improvement-grid">
                            {bottomParams.map((item, idx) => {
                              let isAreaOfConcern = false;
                              if (
                                selectedFaculty.statistics.hasSlot1 &&
                                selectedFaculty.statistics.hasSlot2
                              ) {
                                const prevBottom = getBottomParameters(
                                  selectedFaculty.statistics.slot1.parameterStats
                                );
                                isAreaOfConcern = prevBottom.some(
                                  (p) => p.parameter === item.parameter
                                );
                              }
                              return (
                                <div
                                  key={item.parameter}
                                  className={`improvement-card ${isAreaOfConcern ? 'area-of-concern' : ''}`}
                                  style={
                                    isAreaOfConcern
                                      ? { border: '2px solid #ef4444', background: 'rgba(239,68,68,0.08)' }
                                      : {}
                                  }
                                >
                                  <div className="improvement-rank">
                                    {isAreaOfConcern ? '🚩' : `#${idx + 1}`}
                                  </div>
                                  <div className="improvement-content">
                                    <div style={{ flex: 1 }}>
                                      <span className="improvement-param">{item.parameter}</span>
                                      {isAreaOfConcern && (
                                        <div
                                          style={{
                                            fontSize: '11px',
                                            color: '#ef4444',
                                            fontWeight: '700',
                                            marginTop: '4px',
                                          }}
                                        >
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
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="modal-footer-custom">
              <button className="btn-modal-close" onClick={() => setShowFacultyModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI STATS MODAL ===== */}
      {showAIStatsModal && (
        <div className="modal-overlay" onClick={() => setShowAIStatsModal(false)}>
          <div className="ai-stats-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-custom">
              <div className="modal-title-section">
                <h2>🤖 AI Department Analytics</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAIStatsModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body-custom ai-stats-body">
              {!aiStatsData ? (
                <div className="ai-stats-config">
                  <h3>Configure Analytics Report</h3>
                  <div className="config-section">
                    <label>Select Department</label>
                    <select
                      value={aiStatsDept}
                      onChange={(e) => {
                        setAiStatsDept(e.target.value);
                        setAiStatsYear('');
                        setAiStatsBranch('');
                      }}
                      className="ai-select"
                    >
                      <option value="">Choose Department</option>
                      {Object.keys(allDepartments).map((dept) => (
                        <option key={dept} value={dept}>
                          {dept} ({allDepartments[dept]?.length || 0} Faculty)
                        </option>
                      ))}
                    </select>
                  </div>

                  {aiStatsDept && (
                    <div className="config-section">
                      <label>Filter by Year</label>
                      <select
                        value={aiStatsYear}
                        onChange={(e) => setAiStatsYear(e.target.value)}
                        className="ai-select"
                      >
                        <option value="">All Years</option>
                        <option value="I">I Year</option>
                        <option value="II">II Year</option>
                        <option value="III">III Year</option>
                        <option value="IV">IV Year</option>
                      </select>
                    </div>
                  )}

                  {aiStatsDept && aiStatsDept.includes('S&H') && (
                    <div className="config-section">
                      <label>Filter by Branch</label>
                      <select
                        value={aiStatsBranch}
                        onChange={(e) => setAiStatsBranch(e.target.value)}
                        className="ai-select"
                      >
                        <option value="">All Branches</option>
                        {['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH'].map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="config-section">
                    <label>Semester Comparison</label>
                    <div className="semester-options">
                      {['current', 'previous', 'both'].map((s) => (
                        <button
                          key={s}
                          className={`semester-btn ${selectedSemester === s ? 'active' : ''}`}
                          onClick={() => setSelectedSemester(s)}
                        >
                          {s === 'current' ? 'Current' : s === 'previous' ? 'Previous' : 'Both'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn-generate-stats"
                    onClick={generateAIStatistics}
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? (
                      <>
                        <span className="spinner-small" /> Analyzing...
                      </>
                    ) : (
                      <>
                        <span>🚀</span> Generate AI Report
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="ai-stats-report">
                  {!aiStatsData.hasData ? (
                    <div className="no-data-message">
                      <span className="no-data-icon">📊</span>
                      <h3>No Feedback Data Available</h3>
                      <p>{aiStatsData.message}</p>
                      <button className="btn-back-config" onClick={() => setAiStatsData(null)}>
                        ← Back
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="report-header">
                        <div className="report-title-section">
                          <h2>{aiStatsData.department} Department</h2>
                          {aiStatsData.filters && (
                            <p
                              style={{
                                margin: '4px 0',
                                fontSize: '13px',
                                color: '#64748b',
                                fontWeight: '600',
                              }}
                            >
                              📌 Year: {aiStatsData.filters.year} | Branch: {aiStatsData.filters.branch}
                            </p>
                          )}
                          <span className="report-timestamp">
                            Generated: {aiStatsData.generatedAt}
                          </span>
                        </div>
                        <button className="btn-back-config" onClick={() => setAiStatsData(null)}>
                          ← Back
                        </button>
                      </div>

                      <div className="overall-stats-grid">
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">⭐</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">
                              {aiStatsData.overall.avgCurrentRating}
                            </span>
                            <span className="stat-label-ai">Average Rating</span>
                          </div>
                        </div>
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">👥</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">
                              {aiStatsData.overall.uniqueStudentResponses}
                            </span>
                            <span className="stat-label-ai">Total Responses</span>
                          </div>
                        </div>
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">🎯</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">
                              {getPerformanceLabel(aiStatsData.overall.avgCurrentRating)}
                            </span>
                            <span className="stat-label-ai">Performance Level</span>
                          </div>
                        </div>
                      </div>

                      <div className="performers-section">
                        <h3>🏆 Top Performers</h3>
                        <div className="performers-grid">
                          {aiStatsData.topPerformers.map((faculty, idx) => (
                            <div key={faculty.id} className="performer-card top">
                              <div className="performer-rank">{idx + 1}</div>
                              <div className="performer-info">
                                <h4>{faculty.name}</h4>
                                <p>
                                  {faculty.subject} ({faculty.code})
                                </p>
                              </div>
                              <div className="performer-stats">
                                <span
                                  className="performer-rating"
                                  style={{ color: getRatingColor(faculty.currentRating) }}
                                >
                                  ⭐ {faculty.currentRating}/10
                                </span>
                              </div>
                              <div className="performer-meter">
                                <div
                                  className="meter-fill"
                                  style={{
                                    width: `${(faculty.currentRating / 10) * 100}%`,
                                    backgroundColor: getRatingColor(faculty.currentRating),
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="performers-section">
                        <h3>📈 Needs Improvement</h3>
                        <div className="performers-grid">
                          {aiStatsData.needsImprovement.map((faculty) => (
                            <div key={faculty.id} className="performer-card needs-improvement">
                              <div className="performer-info">
                                <h4>{faculty.name}</h4>
                                <p>
                                  {faculty.subject} ({faculty.code})
                                </p>
                              </div>
                              <div className="performer-stats">
                                <span
                                  className="performer-rating"
                                  style={{ color: getRatingColor(faculty.currentRating) }}
                                >
                                  ⭐ {faculty.currentRating}/10
                                </span>
                              </div>
                              <div className="performer-meter">
                                <div
                                  className="meter-fill"
                                  style={{
                                    width: `${(faculty.currentRating / 10) * 100}%`,
                                    backgroundColor: getRatingColor(faculty.currentRating),
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
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
          <div
            className="modal-content"
            style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0' }}>➕ Add New Department</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="sidebar-label">Select College</label>
                <select
                  className="sidebar-select"
                  value={newDeptCollege}
                  onChange={(e) => setNewDeptCollege(e.target.value)}
                >
                  <option value="">Choose College</option>
                  {Object.keys(colleges).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sidebar-label">Department Name</label>
                <input
                  type="text"
                  className="sidebar-select"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Enter Dept Code"
                />
              </div>
              <div>
                <label className="sidebar-label">Branches (Optional)</label>
                <input
                  type="text"
                  className="sidebar-select"
                  value={newDeptBranches}
                  onChange={(e) => setNewDeptBranches(e.target.value)}
                  placeholder="Comma separated (e.g., CSM, CSD)"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleAddDepartment} className="btn-ai-stats" style={{ flex: 1 }}>
                  ✅ Save
                </button>
                <button
                  onClick={() => setShowAddDeptModal(false)}
                  className="btn-ai-stats"
                  style={{ flex: 1, background: '#64748b' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== COMPARISON MODAL ===== */}
      {showComparisonModal && (
        <div className="modal-overlay" onClick={() => setShowComparisonModal(false)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '900px',
              width: '95%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-custom">
              <div className="modal-title-section">
                <h2>📊 Semester Comparison Tool</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setShowComparisonModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body-custom" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <select
                  className="sidebar-select"
                  value={comparisonCollege}
                  onChange={(e) => {
                    setComparisonCollege(e.target.value);
                    setComparisonDept('');
                  }}
                >
                  <option value="">Select College</option>
                  {Object.keys(colleges).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="sidebar-select"
                  value={comparisonDept}
                  onChange={(e) => setComparisonDept(e.target.value)}
                >
                  <option value="">Select Department</option>
                  {comparisonCollege &&
                    deptStructure[comparisonCollege] &&
                    Object.keys(deptStructure[comparisonCollege]).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                </select>
              </div>

              {comparisonCollege && comparisonDept && (() => {
                const data = getComparisonData();
                return (
                  <div className="comparison-table">
                    <div
                      className="comparison-header"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                    >
                      <span>Faculty Name</span>
                      <span>Slot 1 (Prev)</span>
                      <span>Slot 2 (Curr)</span>
                      <span>Change</span>
                      <span>Status</span>
                    </div>
                    {data.length === 0 ? (
                      <p
                        style={{
                          textAlign: 'center',
                          padding: '30px',
                          color: '#64748b',
                          fontWeight: '600',
                        }}
                      >
                        No comparison data available.
                      </p>
                    ) : (
                      data.map((f) => {
                        const change = parseFloat(f.change);
                        return (
                          <div
                            key={f.id}
                            className="comparison-row"
                            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                          >
                            <div>
                              <strong>{f.name}</strong>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{f.subject}</div>
                            </div>
                            <div style={{ fontWeight: 'bold', color: '#64748b' }}>
                              {f.slot1Avg || '-'}
                            </div>
                            <div
                              style={{
                                fontWeight: 'bold',
                                color: f.slot2Avg ? getRatingColor(parseFloat(f.slot2Avg)) : '#64748b',
                              }}
                            >
                              {f.slot2Avg || '-'}
                            </div>
                            <div
                              style={{
                                fontWeight: 'bold',
                                color:
                                  change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#64748b',
                              }}
                            >
                              {f.change ? (change > 0 ? `+${f.change}` : f.change) : '-'}
                            </div>
                            <div>
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background:
                                    change > 0 ? '#d1fae5' : change < 0 ? '#fee2e2' : '#f3f4f6',
                                  color:
                                    change > 0 ? '#065f46' : change < 0 ? '#991b1b' : '#374151',
                                }}
                              >
                                {change > 0 ? '↑ Improved' : change < 0 ? '↓ Declined' : '→ Stable'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===== SUGGESTION MODAL ===== */}
      {showSuggestionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowSuggestionModal(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '850px',
              width: '90%',
              maxHeight: '85vh',
              overflow: 'hidden',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header-custom"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
            >
              <div className="modal-title-section">
                <h2 style={{ color: 'white' }}>💡 AI Suggestion Analysis</h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowSuggestionModal(false)}
              >
                ✕
              </button>
            </div>
            <div
              className="modal-body-custom"
              style={{ padding: '20px', flex: 1, overflowY: 'auto' }}
            >
              {/* Show spinner until suggestionData is ready (fixes race condition) */}
              {!suggestionData ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div
                    className="spinner-small"
                    style={{
                      margin: '0 auto 16px auto',
                      width: '36px',
                      height: '36px',
                      borderTopColor: '#7c3aed',
                      borderWidth: '4px',
                    }}
                  />
                  <h3 style={{ color: '#64748b' }}>Loading suggestions...</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Fetching student comments.</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 4px 0' }}>
                      Scope:{' '}
                      {suggestionTarget.faculty
                        ? suggestionTarget.faculty
                        : suggestionTarget.dept
                        ? `${suggestionTarget.dept} Department`
                        : `${suggestionTarget.college} College`}
                    </h3>
                    <p style={{ color: '#64748b' }}>
                      Analyzed <strong>{suggestionData.rawCount}</strong> student comments.
                    </p>
                  </div>

                  {/* Summary */}
                  {suggestionData.summary && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: '#f1f5f9',
                        border: '2px solid #cbd5e1',
                        fontWeight: '700',
                        color: '#334155',
                        fontSize: '13px',
                      }}
                    >
                      🧾 Summary: {suggestionData.summary}
                    </div>
                  )}

                  {/* Red Zone */}
                  {suggestionData.redZone && suggestionData.redZone.length > 0 && (
                    <div
                      style={{
                        marginBottom: '20px',
                        padding: '14px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                        border: '2px solid #ef4444',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 10px 0',
                          fontSize: '15px',
                          fontWeight: '900',
                          color: '#991b1b',
                        }}
                      >
                        🚨 Red Zone (Needs Immediate Attention)
                      </h4>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '18px',
                          color: '#7f1d1d',
                          fontWeight: '700',
                          fontSize: '13px',
                        }}
                      >
                        {suggestionData.redZone.map((rz, i) => (
                          <li key={i}>{rz.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestionData.rawCount === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div style={{ fontSize: '60px', marginBottom: '16px' }}>💬</div>
                      <h3 style={{ color: '#64748b' }}>No Comments Available</h3>
                      <p style={{ color: '#94a3b8' }}>
                        Students haven't submitted any comments yet.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Summary Stats */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '12px',
                          marginBottom: '24px',
                        }}
                      >
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: '#ecfdf5',
                            borderRadius: '12px',
                            border: '2px solid #10b981',
                          }}
                        >
                          <div style={{ fontSize: '28px', fontWeight: '900', color: '#10b981' }}>
                            {suggestionData.positiveCount}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#065f46' }}>
                            👍 Positive
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: '#fef2f2',
                            borderRadius: '12px',
                            border: '2px solid #ef4444',
                          }}
                        >
                          <div style={{ fontSize: '28px', fontWeight: '900', color: '#ef4444' }}>
                            {suggestionData.negativeCount}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>
                            ⚠️ Concerns
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: '#f3f4f6',
                            borderRadius: '12px',
                            border: '2px solid #9ca3af',
                          }}
                        >
                          <div style={{ fontSize: '28px', fontWeight: '900', color: '#6b7280' }}>
                            {suggestionData.neutralCount}
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                            💬 Neutral
                          </div>
                        </div>
                      </div>

                      {/* Summarized Suggestions */}
                      {(() => {
                        const allTexts = [
                          ...suggestionData.facultyComments.map((fc) => fc.comment),
                          ...suggestionData.generalComments,
                        ];
                        const kwSummary = generateKeywordSummary(allTexts);
                        if (!kwSummary) return null;
                        return (
                          <div
                            style={{
                              marginBottom: '20px',
                              padding: '18px 20px',
                              borderRadius: '14px',
                              background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                              border: '2px solid #22c55e',
                            }}
                          >
                            <h4
                              style={{
                                margin: '0 0 14px 0',
                                fontSize: '15px',
                                fontWeight: '800',
                                color: '#14532d',
                              }}
                            >
                              📝 Summarized Student Feedback
                            </h4>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '20px',
                                color: '#1e293b',
                                fontSize: '14px',
                                lineHeight: '1.9',
                              }}
                            >
                              <li style={{ marginBottom: '10px' }}>
                                <strong style={{ color: '#16a34a' }}>✅ Strengths: </strong>
                                {kwSummary.bullet1}
                              </li>
                              <li>
                                <strong style={{ color: '#dc2626' }}>⚠️ Areas to Improve: </strong>
                                {kwSummary.bullet2}
                              </li>
                            </ul>
                          </div>
                        );
                      })()}

                      {/* Comment Count Badges */}
                      {(suggestionData.facultyComments.length > 0 ||
                        suggestionData.generalComments.length > 0) && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '10px',
                            flexWrap: 'wrap',
                            marginBottom: '20px',
                          }}
                        >
                          {suggestionData.facultyComments.length > 0 && (
                            <span
                              style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontWeight: '700',
                                fontSize: '13px',
                                border: '2px solid #0ea5e9',
                              }}
                            >
                              🧑‍🏫 {suggestionData.facultyComments.length} Faculty Suggestions
                            </span>
                          )}
                          {suggestionData.generalComments.length > 0 && (
                            <span
                              style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: '#fef9c3',
                                color: '#854d0e',
                                fontWeight: '700',
                                fontSize: '13px',
                                border: '2px solid #eab308',
                              }}
                            >
                              🏫 {suggestionData.generalComments.length} College Suggestions
                            </span>
                          )}
                        </div>
                      )}

                      {/* Teaching Quality Topics */}
                      <div>
                        <h4
                          style={{
                            margin: '0 0 12px 0',
                            fontSize: '16px',
                            fontWeight: '800',
                            color: '#1e293b',
                          }}
                        >
                          📊 Teaching Quality Topics
                        </h4>
                        {suggestionData.topics.length === 0 ? (
                          <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            No specific teaching topics could be extracted.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {suggestionData.topics.map((t, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '8px 16px',
                                  borderRadius: '20px',
                                  fontWeight: '600',
                                  fontSize: '13px',
                                  background:
                                    t.sentiment === 'positive'
                                      ? '#d1fae5'
                                      : t.sentiment === 'negative'
                                      ? '#fee2e2'
                                      : '#f3f4f6',
                                  color:
                                    t.sentiment === 'positive'
                                      ? '#065f46'
                                      : t.sentiment === 'negative'
                                      ? '#991b1b'
                                      : '#374151',
                                }}
                              >
                                {t.sentiment === 'positive'
                                  ? '👍 '
                                  : t.sentiment === 'negative'
                                  ? '⚠️ '
                                  : '💬 '}
                                {t.text} ({t.count})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADMIN SUGGESTIONS VIEW MODAL ===== */}
      {showAdminSuggestionsView && (
        <div
          className="modal-overlay"
          onClick={() => setShowAdminSuggestionsView(false)}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '860px',
              width: '92%',
              maxHeight: '88vh',
              overflow: 'hidden',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-header-custom"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              <div className="modal-title-section">
                <h2 style={{ color: 'white' }}>💡 Student Suggestions Overview</h2>
                {adminSuggestionsData && (
                  <span style={{ color: '#ddd8fe', fontSize: '14px' }}>
                    {adminSuggestionsData.dept} — {adminSuggestionsData.college} College
                  </span>
                )}
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowAdminSuggestionsView(false)}
              >
                ✕
              </button>
            </div>

            <div
              className="modal-body-custom"
              style={{ padding: '24px', flex: 1, overflowY: 'auto' }}
            >
              {isLoadingAdminSuggestions ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div
                    className="spinner-small"
                    style={{
                      margin: '0 auto 16px auto',
                      width: '40px',
                      height: '40px',
                      borderTopColor: '#7c3aed',
                      borderWidth: '4px',
                    }}
                  />
                  <h3 style={{ color: '#64748b' }}>Analyzing student suggestions...</h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                    Filtering by keywords and building summaries.
                  </p>
                </div>
              ) : adminSuggestionsData ? (
                <>
                  {/* Faculty-wise Summaries */}
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '18px',
                      fontWeight: '800',
                      color: '#1e293b',
                      borderBottom: '3px solid #7c3aed',
                      paddingBottom: '10px',
                    }}
                  >
                    🧑‍🏫 Faculty-wise Summarized Suggestions
                  </h3>

                  {adminSuggestionsData.facultySummaries.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: '14px',
                        background: '#f8fafc',
                        border: '2px dashed #cbd5e1',
                        textAlign: 'center',
                        color: '#94a3b8',
                        marginBottom: '28px',
                      }}
                    >
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>💬</div>
                      <p style={{ fontWeight: '700' }}>
                        No faculty-specific suggestions submitted yet.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        marginBottom: '32px',
                      }}
                    >
                      {adminSuggestionsData.facultySummaries.map((fac, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '16px 20px',
                            borderRadius: '14px',
                            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                            border: '2px solid #e2e8f0',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              marginBottom: '12px',
                            }}
                          >
                            <span
                              style={{
                                padding: '4px 12px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: '12px',
                              }}
                            >
                              {fac.code}
                            </span>
                            <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                              {fac.name}
                            </strong>
                            <span
                              style={{
                                marginLeft: 'auto',
                                fontSize: '12px',
                                color: '#64748b',
                                fontWeight: '600',
                              }}
                            >
                              {fac.commentCount} suggestion{fac.commentCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {fac.summary ? (
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '13.5px',
                                color: '#334155',
                                lineHeight: '1.9',
                              }}
                            >
                              <li style={{ marginBottom: '6px' }}>
                                <strong style={{ color: '#16a34a' }}>✅ Strengths: </strong>
                                {fac.summary.bullet1}
                              </li>
                              <li>
                                <strong style={{ color: '#dc2626' }}>⚠️ Improve: </strong>
                                {fac.summary.bullet2}
                              </li>
                            </ul>
                          ) : (
                            <p
                              style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#94a3b8',
                                fontStyle: 'italic',
                              }}
                            >
                              No specific keyword patterns found in suggestions.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  <div
                    style={{
                      height: '3px',
                      background: 'linear-gradient(90deg, #f59e0b, #eab308)',
                      borderRadius: '4px',
                      marginBottom: '28px',
                    }}
                  />

                  {/* College-level Summaries */}
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '18px',
                      fontWeight: '800',
                      color: '#1e293b',
                      borderBottom: '3px solid #f59e0b',
                      paddingBottom: '10px',
                    }}
                  >
                    🏫 College-level Summarized Suggestions
                  </h3>

                  {!adminSuggestionsData.collegeSummary ? (
                    <div
                      style={{
                        padding: '24px',
                        borderRadius: '14px',
                        background: '#fffbeb',
                        border: '2px dashed #fcd34d',
                        textAlign: 'center',
                        color: '#92400e',
                      }}
                    >
                      <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏛️</div>
                      <p style={{ fontWeight: '700' }}>
                        No college-level suggestions submitted yet.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '20px 24px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #fffbeb, #fef9c3)',
                        border: '2px solid #f59e0b',
                      }}
                    >
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '20px',
                          fontSize: '14px',
                          color: '#334155',
                          lineHeight: '2',
                        }}
                      >
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
          <div
            className="modal-content"
            style={{
              maxWidth: '420px',
              padding: '32px',
              textAlign: 'center',
              borderRadius: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800' }}>
              Delete Responses?
            </h3>
            <p style={{ color: '#64748b', marginBottom: '24px', fontSize: '14px' }}>
              Are you sure you want to delete responses for{' '}
              <strong>
                {deleteTarget.faculty
                  ? deleteTarget.faculty.name
                  : deleteTarget.dept
                  ? `${deleteTarget.dept} Dept`
                  : `${deleteTarget.college} College`}
              </strong>
              ?
              <br />
              <span style={{ fontSize: '12px', color: '#ef4444' }}>
                This action cannot be undone.
              </span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => confirmDeleteResponses(true)}
                className="btn-ai-stats"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                📥 Download First, Then Delete
              </button>
              <button
                onClick={() => confirmDeleteResponses(false)}
                className="btn-ai-stats"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                🗑️ Delete Without Downloading
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: 'transparent',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '10px',
                  fontWeight: '700',
                  fontSize: '14px',
                }}
              >
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
