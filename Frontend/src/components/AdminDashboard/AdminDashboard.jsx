import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import dataService from '../../services/dataService.js';
import { generateFacultyPDF, generateDepartmentPDF, generateCollegePDF } from '../../utils/pdfGenerator.js';
import { generateFacultyExcel } from '../../utils/excelGenerator.js';
import { analyzeSuggestions } from '../../utils/suggestionAnalyzer.js';
import './AdminDashboard.css';

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

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Core states
  const [currentUser, setCurrentUser] = useState(null);
  const [allDepartments, setAllDepartments] = useState({});
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [showAIStatsModal, setShowAIStatsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // AI Stats State
  const [aiStatsDept, setAiStatsDept] = useState('');
  const [aiStatsData, setAiStatsData] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('current');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Dynamic structure
  const [DEPT_STRUCTURE, setDeptStructure] = useState(dataService.getDeptStructure());
  const [COLLEGES, setColleges] = useState(() => {
    const struct = dataService.getDeptStructure();
    const obj = {};
    Object.keys(struct).forEach((c) => { obj[c] = c; });
    return obj;
  });

  // Department management
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCollege, setNewDeptCollege] = useState('');
  const [newDeptBranches, setNewDeptBranches] = useState('');

  // Delete responses
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ type: '', college: '', dept: '', faculty: null });

  // Comparison
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonCollege, setComparisonCollege] = useState('');
  const [comparisonDept, setComparisonDept] = useState('');

  // AI Suggestions
  const [suggestionData, setSuggestionData] = useState(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionTarget, setSuggestionTarget] = useState({ college: '', dept: '', faculty: '' });

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('user'));
    } catch (e) {
      console.error('Failed to parse user:', e);
    }

    if (!user || user.role !== 'admin') {
      navigate('/login', { replace: true });
      return;
    }

    setCurrentUser(user);
    loadAllDepartmentData();
    refreshDeptStructure();

    const handleStorageChange = () => {
      loadAllDepartmentData();
      refreshDeptStructure();
    };
    window.addEventListener('storage', handleStorageChange);

    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      const activeUser = JSON.parse(localStorage.getItem('user'));
      if (activeUser && activeUser.role === 'admin') {
        window.history.pushState(null, '', window.location.href);
      } else {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('popstate', handlePopState);

    const interval = setInterval(() => {
      const activeUser = JSON.parse(localStorage.getItem('user'));
      if (activeUser && activeUser.role === 'admin') {
        loadAllDepartmentData();
      } else {
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [navigate]);

  // ==================== DATA LOADING ====================
  const loadAllDepartmentData = () => {
    try {
      const masterFacultyList = JSON.parse(localStorage.getItem('masterFacultyList') || '{}');
      setAllDepartments(masterFacultyList);
    } catch (e) {
      console.error('Failed to load department data:', e);
    }
  };

  const refreshDeptStructure = () => {
    const struct = dataService.getDeptStructure();
    setDeptStructure(struct);
    const obj = {};
    Object.keys(struct).forEach((c) => { obj[c] = c; });
    setColleges(obj);
  };

  // ==================== AUTH ====================
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // ==================== FEEDBACK HELPERS ====================
  const getFacultyFeedback = (facultyId, year, semester) => {
    const feedbackKey = `feedback_${facultyId}_${year}_${semester}`;
    return JSON.parse(localStorage.getItem(feedbackKey) || '[]');
  };

  const calculateFacultyStatistics = (feedbackData) => {
    if (!feedbackData || feedbackData.length === 0) return null;

    const totalResponses = feedbackData.length;
    const slot1Data = feedbackData.filter((f) => f.slot === 1);
    const slot2Data = feedbackData.filter((f) => f.slot === 2);

    const calculateSlotStats = (slotData) => {
      if (!slotData || slotData.length === 0) return null;

      const parameterStats = {};
      PARAMETERS.forEach((param) => {
        const ratings = slotData.map((f) => f.ratings[param]).filter((r) => r !== undefined);
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = ratings.length > 0 ? sum / ratings.length : 0;
        const percentage = (avg / 10) * 100;
        parameterStats[param] = {
          average: avg.toFixed(2),
          percentage: percentage.toFixed(1),
          totalRatings: ratings.length,
        };
      });

      const allRatings = slotData.flatMap((f) => Object.values(f.ratings));
      const overallAvg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

      const ratingDist = {};
      for (let i = 1; i <= 10; i++) ratingDist[i] = 0;
      allRatings.forEach((rating) => {
        ratingDist[rating] = (ratingDist[rating] || 0) + 1;
      });

      return {
        parameterStats,
        overallAverage: overallAvg.toFixed(2),
        ratingDistribution: ratingDist,
        responseCount: slotData.length,
      };
    };

    return {
      totalResponses,
      slot1: calculateSlotStats(slot1Data),
      slot2: calculateSlotStats(slot2Data),
      hasSlot1: slot1Data.length > 0,
      hasSlot2: slot2Data.length > 0,
    };
  };

  // ==================== FACULTY MODAL ====================
  const openFacultyModal = (faculty) => {
    const feedbackData = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
    const statistics = calculateFacultyStatistics(feedbackData);
    setSelectedFaculty({
      ...faculty,
      statistics,
      hasFeedback: feedbackData.length > 0,
    });
    setShowFacultyModal(true);
  };

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

  // ==================== DEPARTMENT MANAGEMENT ====================
  const handleAddDepartment = () => {
    if (!newDeptCollege || !newDeptName.trim()) {
      alert('⚠️ Please select a college and enter department name');
      return;
    }
    const branches = newDeptBranches.trim()
      ? newDeptBranches.split(',').map((b) => b.trim()).filter((b) => b)
      : null;
    const result = dataService.addDepartment(newDeptCollege, newDeptName.trim(), branches);
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

  const handleDeleteCollege = (college) => {
    if (!window.confirm(`🚨 DANGER! This will permanently delete "${college}" College and ALL its data.\n\nThis action CANNOT be undone.`)) return;
    if (!window.confirm(`⚠️ FINAL CONFIRMATION: Delete "${college}" College?`)) return;
    dataService.deleteCollege(college);
    refreshDeptStructure();
    loadAllDepartmentData();
    setSelectedCollege('');
    setSelectedDepartment('');
    alert(`✅ "${college}" College has been deleted.`);
  };

  const handleDeleteDepartment = (college, dept) => {
    if (!window.confirm(`🗑️ Delete "${dept}" department from ${college} College?\n\nAll faculty and feedback data will be permanently removed.`)) return;
    dataService.deleteDepartment(college, dept);
    refreshDeptStructure();
    loadAllDepartmentData();
    setSelectedDepartment('');
    alert(`✅ "${dept}" department deleted from ${college} College.`);
  };

  const handleMergeColleges = () => {
    const colleges = Object.keys(DEPT_STRUCTURE);
    if (colleges.length < 2) {
      alert('⚠️ Need at least 2 colleges to merge');
      return;
    }
    const source = prompt(`Enter the college to MERGE FROM (will be deleted):\nAvailable: ${colleges.join(', ')}`);
    if (!source || !colleges.includes(source)) return;
    const target = prompt(`Enter the college to MERGE INTO (will keep):\nAvailable: ${colleges.filter((c) => c !== source).join(', ')}`);
    if (!target || !colleges.includes(target) || target === source) return;
    if (!window.confirm(`🔄 Merge "${source}" INTO "${target}"?\n\n"${source}" will be deleted after merge.`)) return;
    const result = dataService.mergeColleges(source, target);
    if (result.success) {
      refreshDeptStructure();
      loadAllDepartmentData();
      setSelectedCollege('');
      alert(`✅ "${source}" has been merged into "${target}".`);
    } else {
      alert(`⚠️ ${result.error}`);
    }
  };

  // ==================== DELETE RESPONSES ====================
  const handleDeleteResponses = (type, college, dept, faculty) => {
    setDeleteTarget({ type, college, dept, faculty });
    setShowDeleteModal(true);
  };

  const confirmDeleteResponses = (downloadFirst) => {
    const { type, college, dept, faculty } = deleteTarget;

    if (downloadFirst) {
      if (type === 'faculty' && faculty) {
        const fb = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
        const stats = calculateFacultyStatistics(fb);
        generateFacultyPDF(faculty, stats, college);
      } else if (type === 'department') {
        const deptKey = `${college}_${dept}`;
        const facultyList = allDepartments[deptKey] || [];
        const allStats = {};
        facultyList.forEach((f) => {
          const fb = getFacultyFeedback(f.id, f.year, f.sem);
          allStats[f.id] = calculateFacultyStatistics(fb);
        });
        generateDepartmentPDF(deptKey, facultyList, allStats, college);
      } else if (type === 'college') {
        generateCollegePDF(college, DEPT_STRUCTURE, allDepartments, getFacultyFeedback, calculateFacultyStatistics);
      }
    }

    if (type === 'faculty' && faculty) {
      dataService.deleteFacultyFeedback(faculty.id, faculty.year, faculty.sem);
    } else if (type === 'department') {
      dataService.deleteDepartmentFeedback(college, dept);
    } else if (type === 'college') {
      dataService.deleteCollegeFeedback(college);
    }

    loadAllDepartmentData();
    setShowDeleteModal(false);
    setShowFacultyModal(false);
    alert('✅ Responses deleted successfully!');
  };

  // ==================== AI SUGGESTIONS ====================
  const openSuggestionModal = (college, dept, facultyName) => {
    setSuggestionTarget({ college, dept, faculty: facultyName });
    const masterList = allDepartments;
    const comments = [];

    if (facultyName) {
      const deptKey = `${college}_${dept}`;
      const fList = masterList[deptKey] || [];
      const fac = fList.find((f) => f.name === facultyName);
      if (fac) {
        const fb = getFacultyFeedback(fac.id, fac.year, fac.sem);
        fb.forEach((f) => { if (f.comments) comments.push(f.comments); });
      }
    } else if (dept) {
      const deptKey = `${college}_${dept}`;
      const fList = masterList[deptKey] || [];
      fList.forEach((fac) => {
        const fb = getFacultyFeedback(fac.id, fac.year, fac.sem);
        fb.forEach((f) => { if (f.comments) comments.push(f.comments); });
      });
    } else {
      Object.keys(masterList).forEach((key) => {
        if (key.startsWith(`${college}_`)) {
          const fList = masterList[key] || [];
          fList.forEach((fac) => {
            const fb = getFacultyFeedback(fac.id, fac.year, fac.sem);
            fb.forEach((f) => { if (f.comments) comments.push(f.comments); });
          });
        }
      });
    }

    const analysis = analyzeSuggestions(comments, college, dept, facultyName);
    setSuggestionData(analysis);
    setShowSuggestionModal(true);
  };

  // ==================== COMPARISON ====================
  const getComparisonData = () => {
    if (!comparisonCollege || !comparisonDept) return [];
    const deptKey = `${comparisonCollege}_${comparisonDept}`;
    const facultyList = allDepartments[deptKey] || [];

    return facultyList.map((faculty) => {
      const fb = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
      const stats = calculateFacultyStatistics(fb);
      return {
        ...faculty,
        slot1Avg: stats?.slot1?.overallAverage || null,
        slot2Avg: stats?.slot2?.overallAverage || null,
        slot1Stats: stats?.slot1 || null,
        slot2Stats: stats?.slot2 || null,
        change: stats?.slot1 && stats?.slot2
          ? (parseFloat(stats.slot2.overallAverage) - parseFloat(stats.slot1.overallAverage)).toFixed(2)
          : null,
        hasData: fb.length > 0,
      };
    }).filter((f) => f.hasData);
  };

  // ==================== AI STATISTICS ====================
  const generateAIStatistics = () => {
    if (!aiStatsDept) {
      alert('⚠️ Please select a department first!');
      return;
    }
    const facultyData = allDepartments[aiStatsDept] || [];
    if (facultyData.length === 0) {
      alert('⚠️ No faculty data available for this department!');
      return;
    }
    setIsGeneratingReport(true);
    setTimeout(() => {
      const stats = generateRealStatistics(facultyData, aiStatsDept, selectedSemester);
      setAiStatsData(stats);
      setIsGeneratingReport(false);
    }, 1500);
  };

  const generateRealStatistics = (facultyList, dept, semester) => {
    const facultyStats = facultyList.map((faculty) => {
      const feedbackData = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
      const stats = calculateFacultyStatistics(feedbackData);
      const currentRating = stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0;
      const previousRating = stats?.slot1?.overallAverage || 0;
      return {
        ...faculty,
        currentRating: parseFloat(currentRating),
        previousRating: parseFloat(previousRating),
        improvement: (currentRating - previousRating).toFixed(2),
        totalResponses: stats?.totalResponses || 0,
        hasData: feedbackData.length > 0,
      };
    });

    const facultyWithData = facultyStats.filter((f) => f.hasData);

    if (facultyWithData.length === 0) {
      return { department: dept, semester, hasData: false, message: 'No feedback data available yet.' };
    }

    const avgCurrentRating = (facultyWithData.reduce((sum, f) => sum + f.currentRating, 0) / facultyWithData.length).toFixed(2);
    const avgPreviousRating = (facultyWithData.reduce((sum, f) => sum + f.previousRating, 0) / facultyWithData.length).toFixed(2);

    // Gather suggestions
    const allComments = [];
    facultyWithData.forEach((f) => {
      const fb = getFacultyFeedback(f.id, f.year, f.sem);
      fb.forEach((entry) => { if (entry.comments) allComments.push(entry.comments); });
    });
    const deptParts = dept.split('_');
    const suggestionAnalysis = analyzeSuggestions(allComments, deptParts[0] || '', deptParts[1] || '');

    const topPerformers = [...facultyWithData].sort((a, b) => b.currentRating - a.currentRating).slice(0, 3);
    const needsImprovement = [...facultyWithData].sort((a, b) => a.currentRating - b.currentRating).slice(0, 3);

    return {
      department: dept,
      semester,
      hasData: true,
      facultyStats: facultyWithData,
      overall: {
        avgCurrentRating: parseFloat(avgCurrentRating),
        avgPreviousRating: parseFloat(avgPreviousRating),
        improvement: (avgCurrentRating - avgPreviousRating).toFixed(2),
        uniqueStudentResponses: facultyWithData.reduce((s, f) => s + f.totalResponses, 0),
        totalFaculty: facultyWithData.length,
      },
      topPerformers,
      needsImprovement,
      suggestions: suggestionAnalysis,
      generatedAt: new Date().toLocaleString(),
    };
  };

  // ==================== UTILITY FUNCTIONS ====================
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

  const getFacultyByCollegeDept = (college, dept, subDept = null) => {
    const deptKey = `${college}_${dept}`;
    const deptFaculty = allDepartments[deptKey] || [];
    return deptFaculty.filter((f) => {
      const matchCollege = f.college === college;
      if (subDept && dept === 'S&H') return matchCollege && f.branch === subDept;
      return matchCollege;
    });
  };

  const removeFaculty = (deptKey, facultyId, facultyName = 'this faculty') => {
    if (!window.confirm(`🗑️ Permanently remove "${facultyName}" from Admin master list?`)) return;
    try {
      const masterFacultyList = JSON.parse(localStorage.getItem('masterFacultyList') || '{}');
      if (masterFacultyList[deptKey]) {
        masterFacultyList[deptKey] = masterFacultyList[deptKey].filter((f) => f.id !== facultyId);
        localStorage.setItem('masterFacultyList', JSON.stringify(masterFacultyList));
        loadAllDepartmentData();
        window.dispatchEvent(new Event('storage'));
        alert('✅ Faculty removed from Admin master list successfully!');
      }
    } catch (e) {
      console.error('Remove error:', e);
      alert('⚠️ Failed to remove faculty.');
    }
  };

  const calculateDepartmentStats = (facultyList) => {
    if (!facultyList || facultyList.length === 0) return { avgRating: 0, satisfactionRate: 0, totalResponses: 0 };
    let totalRating = 0, totalResponses = 0, facultyWithFeedback = 0;
    facultyList.forEach((faculty) => {
      const feedback = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
      if (feedback.length > 0) {
        const stats = calculateFacultyStatistics(feedback);
        const rating = stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0;
        totalRating += parseFloat(rating);
        totalResponses += feedback.length;
        facultyWithFeedback++;
      }
    });
    const avgRating = facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : 0;
    const satisfactionRate = facultyWithFeedback > 0 ? ((avgRating / 10) * 100).toFixed(1) : 0;
    return { avgRating, satisfactionRate: parseFloat(satisfactionRate), totalResponses };
  };

  const calculateCollegeStats = (college) => {
    const distribution = { Outstanding: 0, Excellent: 0, 'Very Good': 0, Good: 0, Average: 0, 'Needs Improvement': 0 };
    let totalFaculty = 0, totalResponses = 0, totalRating = 0, facultyWithFeedback = 0;
    Object.keys(DEPT_STRUCTURE[college] || {}).forEach((dept) => {
      const deptKey = `${college}_${dept}`;
      const deptFaculty = allDepartments[deptKey] || [];
      deptFaculty.forEach((faculty) => {
        totalFaculty++;
        const feedback = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
        if (feedback.length > 0) {
          const stats = calculateFacultyStatistics(feedback);
          const rating = parseFloat(stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0);
          totalRating += rating;
          totalResponses += feedback.length;
          facultyWithFeedback++;
          const label = getPerformanceLabel(rating);
          if (distribution[label] !== undefined) distribution[label]++;
        }
      });
    });
    const avgRating = facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : '0.00';
    return { distribution, totalFaculty, totalResponses, avgRating };
  };

  // ==================== COMPUTED VALUES ====================
  const currentDeptStructure = selectedCollege ? DEPT_STRUCTURE[selectedCollege] || {} : {};

  const currentFaculty = useMemo(() => {
    if (!selectedCollege || !selectedDepartment) return [];
    return getFacultyByCollegeDept(selectedCollege, selectedDepartment, selectedSubDept);
  }, [selectedCollege, selectedDepartment, selectedSubDept, allDepartments]);

  const filteredFaculty = useMemo(() => {
    if (!searchTerm.trim()) return currentFaculty;
    const term = searchTerm.toLowerCase();
    return currentFaculty.filter(
      (f) => f.name.toLowerCase().includes(term) || f.code.toLowerCase().includes(term) || f.subject.toLowerCase().includes(term)
    );
  }, [searchTerm, currentFaculty]);

  const groupedFaculty = useMemo(() => {
    if (selectedDepartment === 'S&H') {
      const branches = currentDeptStructure['S&H'] || [];
      const grouped = {};
      branches.forEach((branch) => { grouped[branch] = filteredFaculty.filter((f) => f.branch === branch); });
      return grouped;
    } else {
      const grouped = {};
      YEARS.forEach((year) => { grouped[year] = filteredFaculty.filter((f) => f.year === year); });
      return grouped;
    }
  }, [filteredFaculty, selectedDepartment, currentDeptStructure]);

  const totalFaculty = Object.values(allDepartments).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  const totalDepts = Object.keys(allDepartments).length;

  // ==================== GUARD ====================
  if (!currentUser) return null;

  // ==================== RENDER HELPERS ====================
  const renderFacultyCard = (faculty) => (
    <div key={faculty.id} className="faculty-card-compact" onClick={() => openFacultyModal(faculty)}>
      <div className="faculty-card-header-compact">
        <span className="faculty-code-badge-compact">{faculty.code}</span>
        <span className="faculty-year-badge-compact">Y{faculty.year}</span>
        <button
          className="faculty-remove-chip"
          onClick={(e) => {
            e.stopPropagation();
            const deptKey = `${faculty.college}_${faculty.dept}`;
            removeFaculty(deptKey, faculty.id, faculty.name);
          }}
          title="Remove from Admin master list"
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

  // ==================== JSX ====================
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-small"><span>RISE</span></div>
          <div className="header-info">
            <h2>Master Admin Portal</h2>
            <span className="dept-badge admin">Global Control</span>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-ai-stats" onClick={() => setShowAIStatsModal(true)}>
            <span>🤖</span> AI Statistics
          </button>
          <button className="btn-ai-stats" onClick={() => setShowComparisonModal(true)} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
            <span>📊</span> Compare
          </button>
          <button className="btn-ai-stats" onClick={() => setShowAddDeptModal(true)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <span>➕</span> Add Dept
          </button>
          <button className="btn-ai-stats" onClick={handleMergeColleges} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <span>🔄</span> Merge
          </button>
          <div className="user-info">
            <span className="user-icon">👑</span>
            <span className="user-name">{currentUser.username}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <span>🚪</span> Logout
          </button>
        </div>
      </header>

      <main className="master-layout">
        {/* Sidebar */}
        <aside className="master-sidebar">
          <div className="sidebar-header"><h3>🏛️ Navigation</h3></div>

          <div className="sidebar-section">
            <div className="search-bar-sidebar">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search faculty..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="sidebar-section">
            <label className="sidebar-label">Select College</label>
            <select
              value={selectedCollege}
              onChange={(e) => { setSelectedCollege(e.target.value); setSelectedDepartment(''); setSelectedSubDept(''); }}
              className="sidebar-select"
            >
              <option value="">Choose College</option>
              {Object.values(COLLEGES).map((college) => (
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
                      onClick={() => { setSelectedDepartment(deptCode); setSelectedSubDept(''); }}
                    >
                      <span className="menu-icon">🏫</span>
                      <span>{deptCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Management Section */}
          {selectedCollege && (
            <div className="sidebar-section" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #e2e8f0' }}>
              <h4 className="sidebar-heading">⚙️ Management</h4>
              {selectedDepartment && (
                <>
                  <button className="sidebar-menu-item" style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => openSuggestionModal(selectedCollege, selectedDepartment, null)}>
                    <span className="menu-icon">💡</span> View Suggestions
                  </button>
                  <button className="sidebar-menu-item" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => handleDeleteResponses('department', selectedCollege, selectedDepartment, null)}>
                    <span className="menu-icon">🗑️</span> Delete {selectedDepartment} Responses
                  </button>
                  <button className="sidebar-menu-item" style={{ background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontSize: '12px', marginBottom: '6px' }}
                    onClick={() => handleDeleteDepartment(selectedCollege, selectedDepartment)}>
                    <span className="menu-icon">❌</span> Delete {selectedDepartment} Dept
                  </button>
                </>
              )}
              <button className="sidebar-menu-item" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', marginBottom: '6px' }}
                onClick={() => handleDeleteResponses('college', selectedCollege, '', null)}>
                <span className="menu-icon">🗑️</span> Delete All {selectedCollege} Responses
              </button>
              <button className="sidebar-menu-item" style={{ background: 'rgba(239,68,68,0.2)', color: '#b91c1c', fontSize: '12px' }}
                onClick={() => handleDeleteCollege(selectedCollege)}>
                <span className="menu-icon">💀</span> Delete {selectedCollege} College
              </button>
            </div>
          )}
        </aside>

        {/* Main Content */}
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
                {Object.values(COLLEGES).map((college) => {
                  const collegeData = Object.keys(DEPT_STRUCTURE[college] || {}).map((dept) => {
                    const deptKey = `${college}_${dept}`;
                    const deptFaculty = allDepartments[deptKey] || [];
                    const stats = calculateDepartmentStats(deptFaculty);
                    return { dept, avgRating: parseFloat(stats.avgRating), satisfactionRate: stats.satisfactionRate, totalResponses: stats.totalResponses, facultyCount: deptFaculty.length };
                  });
                  const maxRating = 10.0;

                  return (
                    <div key={college} className="college-analytics-card">
                      <div className="college-card-header">
                        <h3>🏛️ {college} College</h3>
                        <button className="btn-view-college" onClick={() => setSelectedCollege(college)}>View Details →</button>
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
                                <div key={line} className="grid-line" style={{ bottom: `${(line / maxRating) * 100}%` }} />
                              ))}
                            </div>
                            <div className="chart-bars">
                              {collegeData.map((data, index) => (
                                <div key={data.dept} className="bar-wrapper">
                                  <div className="bar-container">
                                    <div className="bar-fill" style={{ height: `${(data.avgRating / maxRating) * 100}%`, backgroundColor: getRatingColor(data.avgRating), animationDelay: `${index * 0.1}s` }}>
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
                        <div className="x-axis"><div className="x-axis-label">Departments</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="college-pie-charts-section">
                <h3>📊 Performance Distribution by College</h3>
                <div className="pie-charts-grid">
                  {Object.values(COLLEGES).map((college) => {
                    const collegeStats = calculateCollegeStats(college);
                    return (
                      <div key={college} className="college-pie-card">
                        <div className="pie-card-header">
                          <h4>{college} College</h4>
                          <div className="pie-card-summary">
                            <span className="pie-summary-item">👥 {collegeStats.totalFaculty} Faculty</span>
                            <span className="pie-summary-item">⭐ {collegeStats.avgRating}/10 Avg</span>
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
                            const percentage = collegeStats.totalFaculty > 0 ? ((count / collegeStats.totalFaculty) * 100).toFixed(1) : 0;
                            return (
                              <div key={category.label} className="pie-segment-item">
                                <div className="pie-segment-header">
                                  <span className="pie-emoji">{category.emoji}</span>
                                  <span className="pie-label">{category.label}</span>
                                </div>
                                <div className="pie-bar-container">
                                  <div className="pie-bar-fill" style={{ width: `${percentage}%`, backgroundColor: category.color }} />
                                </div>
                                <div className="pie-segment-stats">
                                  <span>{count} faculty</span>
                                  <span className="percentage-badge">{percentage}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="pie-card-footer">📝 Total Responses: {collegeStats.totalResponses}</div>
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

      {/* ==================== FACULTY DETAIL MODAL ==================== */}
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
                <div className="info-item"><span className="info-label">Code</span><span className="info-value">{selectedFaculty.code}</span></div>
                <div className="info-item"><span className="info-label">Subject</span><span className="info-value">{selectedFaculty.subject}</span></div>
                <div className="info-item"><span className="info-label">Year</span><span className="info-value">{selectedFaculty.year}</span></div>
                <div className="info-item"><span className="info-label">Semester</span><span className="info-value">{selectedFaculty.sem}</span></div>
                <div className="info-item"><span className="info-label">Section</span><span className="info-value">{selectedFaculty.sec}</span></div>
                <div className="info-item"><span className="info-label">Added</span><span className="info-value">{selectedFaculty.addedDate || 'N/A'}</span></div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button onClick={() => { generateFacultyPDF(selectedFaculty, selectedFaculty.statistics, selectedFaculty.college); }}
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                  📄 Download PDF
                </button>
                <button onClick={() => { const fb = getFacultyFeedback(selectedFaculty.id, selectedFaculty.year, selectedFaculty.sem); generateFacultyExcel(selectedFaculty, fb, selectedFaculty.statistics); }}
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                  📊 Download Excel
                </button>
                <button onClick={() => handleDeleteResponses('faculty', selectedFaculty.college, selectedFaculty.dept, selectedFaculty)}
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                  🗑️ Delete Responses
                </button>
                <button onClick={() => openSuggestionModal(selectedFaculty.college, selectedFaculty.dept, selectedFaculty.name)}
                  style={{ padding: '8px 16px', background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
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
                              <span style={{ marginLeft: '12px', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                                background: diff > 0 ? 'rgba(16,185,129,0.15)' : diff < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#f59e0b' }}>
                                {diff > 0 ? `↑ +${diff}` : diff < 0 ? `↓ ${diff}` : '→ No Change'} from Previous
                              </span>
                            );
                          })()}
                        </h4>
                        <div className="stats-overview">
                          <div className="stat-box"><span className="stat-number">{slotData.responseCount}</span><span className="stat-text">Responses</span></div>
                          <div className="stat-box highlight"><span className="stat-number">{slotData.overallAverage}</span><span className="stat-text">Average Rating</span></div>
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
                                <div className="rating-bar-bg"><div className="rating-bar-fill" style={{ width: `${percentage}%` }} /></div>
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
                                <div className="param-score-bar"><div className="param-score-fill" style={{ width: `${paramStats.percentage}%` }} /></div>
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

                  {/* Areas of Excellence & Improvement */}
                  {(() => {
                    const activeSlot = selectedFaculty.statistics.hasSlot2 ? selectedFaculty.statistics.slot2 : selectedFaculty.statistics.slot1;
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
                              if (selectedFaculty.statistics.hasSlot1 && selectedFaculty.statistics.hasSlot2) {
                                const prevBottom = getBottomParameters(selectedFaculty.statistics.slot1.parameterStats);
                                isAreaOfConcern = prevBottom.some((p) => p.parameter === item.parameter);
                              }
                              return (
                                <div key={item.parameter} className={`improvement-card ${isAreaOfConcern ? 'area-of-concern' : ''}`}
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

      {/* ==================== AI STATS MODAL ==================== */}
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
                    <select value={aiStatsDept} onChange={(e) => setAiStatsDept(e.target.value)} className="ai-select">
                      <option value="">Choose Department</option>
                      {Object.keys(allDepartments).map((dept) => (
                        <option key={dept} value={dept}>{dept} ({allDepartments[dept]?.length || 0} Faculty)</option>
                      ))}
                    </select>
                  </div>
                  <div className="config-section">
                    <label>Semester Comparison</label>
                    <div className="semester-options">
                      {['current', 'previous', 'both'].map((s) => (
                        <button key={s} className={`semester-btn ${selectedSemester === s ? 'active' : ''}`} onClick={() => setSelectedSemester(s)}>
                          {s === 'current' ? 'Current Semester' : s === 'previous' ? 'Previous Semester' : 'Both (Comparison)'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn-generate-stats" onClick={generateAIStatistics} disabled={isGeneratingReport}>
                    {isGeneratingReport ? (<><span className="spinner-small" /> Analyzing...</>) : (<><span>🚀</span> Generate AI Report</>)}
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
                          <p className="report-subtitle">{selectedSemester === 'both' ? 'Semester Comparison' : selectedSemester === 'current' ? 'Current Semester' : 'Previous Semester'}</p>
                          <span className="report-timestamp">Generated: {aiStatsData.generatedAt}</span>
                        </div>
                        <button className="btn-back-config" onClick={() => setAiStatsData(null)}>← Back</button>
                      </div>

                      <div className="overall-stats-grid">
                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">⭐</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">{aiStatsData.overall.avgCurrentRating}</span>
                            <span className="stat-label-ai">Average Rating (out of 10)</span>
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

                      {/* AI Suggestions Section */}
                      {aiStatsData.suggestions && aiStatsData.suggestions.rawCount > 0 && (
                        <div style={{ margin: '20px 0', padding: '20px', background: 'linear-gradient(135deg,#fef3c7,#fde68a)', borderRadius: '14px', border: '2px solid #f59e0b' }}>
                          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '800', color:'#b45309' 
                          }}>
                            💡 AI Analysis of Student Comments ({aiStatsData.suggestions.rawCount})
                          </h3>
                          <div className="suggestion-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {aiStatsData.suggestions.topics.map((topic, i) => (
                              <span key={i} style={{
                                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                                backgroundColor: topic.sentiment === 'positive' ? '#d1fae5' : topic.sentiment === 'negative' ? '#fee2e2' : '#f3f4f6',
                                color: topic.sentiment === 'positive' ? '#065f46' : topic.sentiment === 'negative' ? '#991b1b' : '#374151',
                                border: '1px solid rgba(0,0,0,0.05)'
                              }}>
                                {topic.text} <span style={{ opacity: 0.7 }}>({topic.count})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="performers-section">
                        <h3>🏆 Top Performers</h3>
                        <div className="performers-grid">
                          {aiStatsData.topPerformers.map((faculty, idx) => (
                            <div key={faculty.id} className="performer-card top">
                              <div className="performer-rank">{idx + 1}</div>
                              <div className="performer-info">
                                <h4>{faculty.name}</h4>
                                <p>{faculty.subject} ({faculty.code})</p>
                              </div>
                              <div className="performer-stats">
                                <span className="performer-rating" style={{ color: getRatingColor(faculty.currentRating) }}>
                                  ⭐ {faculty.currentRating}/10
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="performers-section">
                        <h3>📈 Needs Improvement</h3>
                        <div className="performers-grid">
                          {aiStatsData.needsImprovement.map((faculty, idx) => (
                            <div key={faculty.id} className="performer-card needs-improvement">
                              <div className="performer-info">
                                <h4>{faculty.name}</h4>
                                <p>{faculty.subject} ({faculty.code})</p>
                              </div>
                              <div className="performer-stats">
                                <span className="performer-rating" style={{ color: getRatingColor(faculty.currentRating) }}>
                                  ⭐ {faculty.currentRating}/10
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="faculty-comparison-section">
                        <h3>📊 Faculty Performance Overview</h3>
                        <div className="comparison-table">
                          <div className="comparison-header">
                            <span>Faculty</span>
                            <span>Subject</span>
                            <span>Rating</span>
                            {selectedSemester === 'both' && <span>Change</span>}
                            <span>Responses</span>
                          </div>
                          {aiStatsData.facultyStats.map((faculty) => (
                            <div key={faculty.id} className="comparison-row">
                              <div className="faculty-info-compact"><strong>{faculty.name}</strong></div>
                              <span className="subject-text">{faculty.subject}</span>
                              <span className="rating-badge" style={{ backgroundColor: getRatingColor(faculty.currentRating) }}>
                                {faculty.currentRating}
                              </span>
                              {selectedSemester === 'both' && (
                                <span className={`change-badge ${faculty.improvement > 0 ? 'positive' : 'negative'}`}>
                                  {faculty.improvement > 0 ? '↑' : '↓'} {faculty.improvement}
                                </span>
                              )}
                              <span>{faculty.totalResponses}</span>
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

      {/* ==================== ADD DEPARTMENT MODAL ==================== */}
      {showAddDeptModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '16px' }}>
            <h2>➕ Add New Department</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label className="sidebar-label">Select College</label>
                <select className="sidebar-select" value={newDeptCollege} onChange={(e) => setNewDeptCollege(e.target.value)}>
                  <option value="">Choose College</option>
                  {Object.keys(COLLEGES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="sidebar-label">Department Name (e.g., CSE, ECE)</label>
                <input type="text" className="sidebar-select" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="Enter Dept Code" />
              </div>
              <div>
                <label className="sidebar-label">Branches (Optional for S&H)</label>
                <input type="text" className="sidebar-select" value={newDeptBranches} onChange={(e) => setNewDeptBranches(e.target.value)} placeholder="Comma separated (e.g., CSM, CSD)" />
                <small style={{ color: '#64748b' }}>Only required if adding a department like S&H that has sub-branches.</small>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleAddDepartment} className="btn-ai-stats" style={{ flex: 1 }}>Save</button>
                <button onClick={() => setShowAddDeptModal(false)} className="btn-ai-stats" style={{ flex: 1, background: '#64748b' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COMPARISON MODAL ==================== */}
      {showComparisonModal && (
        <div className="modal-overlay" onClick={() => setShowComparisonModal(false)}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '95%', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h2>📊 Semester Comparison Tool</h2>
              <button className="modal-close-btn" onClick={() => setShowComparisonModal(false)}>✕</button>
            </div>
            <div className="modal-body-custom">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <select className="sidebar-select" value={comparisonCollege} onChange={e => setComparisonCollege(e.target.value)}>
                  <option value="">Select College</option>
                  {Object.keys(COLLEGES).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="sidebar-select" value={comparisonDept} onChange={e => setComparisonDept(e.target.value)}>
                  <option value="">Select Department</option>
                  {comparisonCollege && DEPT_STRUCTURE[comparisonCollege] && Object.keys(DEPT_STRUCTURE[comparisonCollege]).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {comparisonCollege && comparisonDept && (
                <div className="comparison-table">
                   <div className="comparison-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                      <span>Faculty Name</span>
                      <span>Slot 1 (Prev)</span>
                      <span>Slot 2 (Curr)</span>
                      <span>Change</span>
                      <span>Status</span>
                   </div>
                   {getComparisonData().map(f => {
                     const change = parseFloat(f.change);
                     return (
                       <div key={f.id} className="comparison-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                         <div>
                           <strong>{f.name}</strong>
                           <div style={{fontSize:'12px', color:'#64748b'}}>{f.subject}</div>
                         </div>
                         <div style={{fontWeight:'bold', color:'#64748b'}}>{f.slot1Avg || '-'}</div>
                         <div style={{fontWeight:'bold', color: getRatingColor(parseFloat(f.slot2Avg))}}>{f.slot2Avg || '-'}</div>
                         <div style={{
                           fontWeight:'bold', 
                           color: change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#64748b'
                         }}>
                           {change ? (change > 0 ? `+${change}` : change) : '-'}
                         </div>
                         <div>
                           <span className={`performance-badge ${change > 0 ? 'good' : change < 0 ? 'poor' : 'average'}`}>
                             {change > 0 ? 'Improved' : change < 0 ? 'Declined' : 'Stable'}
                           </span>
                         </div>
                       </div>
                     );
                   })}
                   {getComparisonData().length === 0 && <p style={{textAlign:'center', padding:'20px'}}>No comparison data available.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUGGESTION ANALYSIS MODAL ==================== */}
      {showSuggestionModal && suggestionData && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
           <div className="modal-content" style={{ maxWidth: '800px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
             <div className="modal-header-custom" style={{background: 'linear-gradient(135deg, #7c3aed, #6d28d9)'}}>
                <h2 style={{color:'white'}}>💡 AI Suggestion Analysis</h2>
                <button className="modal-close-btn" style={{color:'white'}} onClick={() => setShowSuggestionModal(false)}>✕</button>
             </div>
             <div className="modal-body-custom" style={{padding:'20px'}}>
                <div style={{marginBottom:'20px'}}>
                  <h3>Scope: {suggestionTarget.faculty ? suggestionTarget.faculty : `${suggestionTarget.dept || 'All'} Department`}</h3>
                  <p>Analyzed <strong>{suggestionData.rawCount}</strong> comments.</p>
                </div>

                <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap:'20px'}}>
                  <div className="stat-box" style={{background:'#ecfdf5', border:'1px solid #10b981'}}>
                    <span style={{fontSize:'24px', color:'#10b981'}}>👍</span>
                    <div>
                      <h4>Positive Themes</h4>
                      <p>What students like</p>
                    </div>
                  </div>
                  <div className="stat-box" style={{background:'#fef2f2', border:'1px solid #ef4444'}}>
                    <span style={{fontSize:'24px', color:'#ef4444'}}>⚠️</span>
                    <div>
                      <h4>Areas of Concern</h4>
                      <p>What needs attention</p>
                    </div>
                  </div>
                </div>

                <div style={{marginTop:'24px'}}>
                  <h4>Key Topics Identified</h4>
                  <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'10px'}}>
                    {suggestionData.topics.map((t, i) => (
                      <span key={i} style={{
                        padding:'8px 16px', borderRadius:'20px', fontWeight:'600',
                        background: t.sentiment === 'positive' ? '#d1fae5' : t.sentiment === 'negative' ? '#fee2e2' : '#f3f4f6',
                        color: t.sentiment === 'positive' ? '#065f46' : t.sentiment === 'negative' ? '#991b1b' : '#374151'
                      }}>
                        {t.text} ({t.count})
                      </span>
                    ))}
                  </div>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
            <h3>Delete Responses?</h3>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Are you sure you want to delete responses for 
              <strong> {deleteTarget.faculty ? deleteTarget.faculty.name : deleteTarget.dept ? deleteTarget.dept : deleteTarget.college}</strong>?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => confirmDeleteResponses(true)}
                className="btn-ai-stats" 
                style={{ background: '#10b981' }}
              >
                📥 Download & Delete
              </button>
              <button 
                onClick={() => confirmDeleteResponses(false)}
                className="btn-ai-stats" 
                style={{ background: '#ef4444' }}
              >
                🗑️ Delete Only
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}
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