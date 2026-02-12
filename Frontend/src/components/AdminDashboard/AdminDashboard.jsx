import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
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

const COLLEGES = { Gandhi: 'Gandhi', Prakasam: 'Prakasam' };

const DEPT_STRUCTURE = {
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

const YEARS = ['II', 'III', 'IV'];

const AdminDashboard = () => {
  const navigate = useNavigate();

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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    setCurrentUser(user);
    loadAllDepartmentData();

    const handleStorageChange = () => loadAllDepartmentData();
    window.addEventListener('storage', handleStorageChange);

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
      clearInterval(interval);
    };
  }, [navigate]);

  
  const loadAllDepartmentData = () => {
    try {
      const masterFacultyList = JSON.parse(
        localStorage.getItem('masterFacultyList') || '{}'
      );
      setAllDepartments(masterFacultyList);
    } catch (e) {
      console.error('Failed to load department data:', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

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
        const ratings = slotData
          .map((f) => f.ratings[param])
          .filter((r) => r !== undefined);
        const sum = ratings.reduce((a, b) => a + b, 0);
        const avg = ratings.length > 0 ? sum / ratings.length : 0;
        const percentage = (avg / 5) * 100;
        parameterStats[param] = {
          average: avg.toFixed(2),
          percentage: percentage.toFixed(1),
          totalRatings: ratings.length,
        };
      });

      const allRatings = slotData.flatMap((f) => Object.values(f.ratings));
      const overallAvg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

      const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
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

    const slot1Stats = calculateSlotStats(slot1Data);
    const slot2Stats = calculateSlotStats(slot2Data);

    return {
      totalResponses,
      slot1: slot1Stats,
      slot2: slot2Stats,
      hasSlot1: slot1Data.length > 0,
      hasSlot2: slot2Data.length > 0,
    };
  };

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

// Helper function to get top 3 parameters (Areas of Excellence)
const getTopParameters = (parameterStats, count = 3) => {
  if (!parameterStats) return [];
  return Object.entries(parameterStats)
    .sort(([, a], [, b]) => parseFloat(b.average) - parseFloat(a.average))
    .slice(0, count)
    .map(([param, stats]) => ({ parameter: param, ...stats }));
};

// Helper function to get bottom 3 parameters (Areas of Improvement)
const getBottomParameters = (parameterStats, count = 3) => {
  if (!parameterStats) return [];
  return Object.entries(parameterStats)
    .sort(([, a], [, b]) => parseFloat(a.average) - parseFloat(b.average))
    .slice(0, count)
    .map(([param, stats]) => ({ parameter: param, ...stats }));
};


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
      return {
        department: dept,
        semester,
        hasData: false,
        message: 'No feedback data available yet. Students need to submit feedback first.',
      };
    }

    const avgCurrentRating = (
      facultyWithData.reduce((sum, f) => sum + f.currentRating, 0) / facultyWithData.length
    ).toFixed(2);

    const avgPreviousRating = (
      facultyWithData.reduce((sum, f) => sum + f.previousRating, 0) / facultyWithData.length
    ).toFixed(2);

    const allFeedbackData = JSON.parse(localStorage.getItem('feedbackData') || '[]');
    const deptFeedback = allFeedbackData.filter((fb) => {
      return fb.responses.some((r) => {
        const matchingFaculty = facultyWithData.find(
          (f) => f.id === r.facultyId && f.year === r.year && f.semester === r.semester
        );
        return matchingFaculty !== undefined;
      });
    });

    const uniqueStudentResponses = deptFeedback.length;

    const topPerformers = [...facultyWithData]
      .sort((a, b) => b.currentRating - a.currentRating)
      .slice(0, 3);

    const needsImprovement = [...facultyWithData]
      .sort((a, b) => a.currentRating - b.currentRating)
      .slice(0, 3);

    return {
      department: dept,
      semester,
      hasData: true,
      facultyStats: facultyWithData,
      overall: {
        avgCurrentRating: parseFloat(avgCurrentRating),
        avgPreviousRating: parseFloat(avgPreviousRating),
        improvement: (avgCurrentRating - avgPreviousRating).toFixed(2),
        uniqueStudentResponses,
        totalFaculty: facultyWithData.length,
      },
      topPerformers,
      needsImprovement,
      generatedAt: new Date().toLocaleString(),
    };
  };

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return '#10b981';
    if (rating >= 4.0) return '#3b82f6';
    if (rating >= 3.5) return '#f59e0b';
    if (rating >= 3.0) return '#f97316';
    return '#ef4444';
  };

  const getPerformanceLabel = (rating) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 4.0) return 'Very Good';
    if (rating >= 3.5) return 'Good';
    if (rating >= 3.0) return 'Satisfactory';
    return 'Needs Improvement';
  };

  const getFacultyByCollegeDept = (college, dept, subDept = null) => {
    const deptKey = `${college}_${dept}`;
    const deptFaculty = allDepartments[deptKey] || [];

    return deptFaculty.filter((f) => {
      const matchCollege = f.college === college;
      if (subDept && dept === 'S&H') {
        return matchCollege && f.branch === subDept;
      }
      return matchCollege;
    });
  };

  const currentDeptStructure = selectedCollege ? DEPT_STRUCTURE[selectedCollege] || {} : {};

  const currentFaculty = useMemo(() => {
    if (!selectedCollege || !selectedDepartment) return [];
    return getFacultyByCollegeDept(selectedCollege, selectedDepartment, selectedSubDept);
  }, [selectedCollege, selectedDepartment, selectedSubDept, allDepartments]);

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

  const totalFaculty = Object.values(allDepartments).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  const totalDepts = Object.keys(allDepartments).length;


  const calculateCollegeStats = (college) => {
    const distribution = {
      Excellent: 0,
      'Very Good': 0,
      Good: 0,
      Satisfactory: 0,
      'Needs Improvement': 0,
    };

    let totalFaculty = 0;
    let totalResponses = 0;
    let totalRating = 0;
    let facultyWithFeedback = 0;

    Object.keys(DEPT_STRUCTURE[college] || {}).forEach((dept) => {
      const deptKey = `${college}_${dept}`;
      const deptFaculty = allDepartments[deptKey] || [];

      deptFaculty.forEach((faculty) => {
        totalFaculty++;
        const feedback = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
        if (feedback.length > 0) {
          const stats = calculateFacultyStatistics(feedback);
          const rating = parseFloat(
            stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0
          );
          totalRating += rating;
          totalResponses += feedback.length;
          facultyWithFeedback++;

          if (rating >= 4.5) distribution['Excellent']++;
          else if (rating >= 4.0) distribution['Very Good']++;
          else if (rating >= 3.5) distribution['Good']++;
          else if (rating >= 3.0) distribution['Satisfactory']++;
          else distribution['Needs Improvement']++;
        }
      });
    });

    const avgRating =
      facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : '0.00';

    return {
      distribution,
      totalFaculty,
      totalResponses,
      avgRating,
    };
  };

  const removeFaculty = (deptKey, facultyId, facultyName = 'this faculty') => {
  if (
    !window.confirm(
      `🗑️ Permanently remove "${facultyName}" from Admin master list?\n\nNote: This will NOT affect HOD's department list.`
    )
  ) {
    return;
  }

  try {
    const masterFacultyList = JSON.parse(
      localStorage.getItem('masterFacultyList') || '{}'
    );

    if (masterFacultyList[deptKey]) {
      masterFacultyList[deptKey] = masterFacultyList[deptKey].filter(
        (f) => f.id !== facultyId
      );

      localStorage.setItem(
        'masterFacultyList',
        JSON.stringify(masterFacultyList)
      );

      // Important: Do NOT touch faculty_{college}_{dept} keys (HOD data remains intact)
      loadAllDepartmentData();
      window.dispatchEvent(new Event('storage'));
      
      alert('✅ Faculty removed from Admin master list successfully!');
    }
  } catch (e) {
    console.error('Remove error:', e);
    alert('⚠️ Failed to remove faculty. Please try again.');
  }
};


  if (!currentUser) return null;

  const calculateDepartmentStats = (facultyList) => {
    if (!facultyList || facultyList.length === 0) {
      return {
        avgRating: 0,
        satisfactionRate: 0,
        totalResponses: 0,
      };
    }

    let totalRating = 0;
    let totalResponses = 0;
    let facultyWithFeedback = 0;

    facultyList.forEach((faculty) => {
      const feedback = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
      if (feedback.length > 0) {
        const stats = calculateFacultyStatistics(feedback);
        const rating =
          stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0;
        totalRating += parseFloat(rating);
        totalResponses += feedback.length;
        facultyWithFeedback++;
      }
    });

    const avgRating =
      facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : 0;
    const satisfactionRate =
      facultyWithFeedback > 0 ? ((avgRating / 5) * 100).toFixed(1) : 0;

    return {
      avgRating,
      satisfactionRate: parseFloat(satisfactionRate),
      totalResponses,
    };
  };

  const calculateOverallStats = () => {
    const distribution = {
      Excellent: 0,
      'Very Good': 0,
      Good: 0,
      Satisfactory: 0,
      'Needs Improvement': 0,
    };

    let totalFaculty = 0;
    let totalResponses = 0;
    let totalRating = 0;
    let facultyWithFeedback = 0;

    Object.values(allDepartments).forEach((deptFaculty) => {
      if (!deptFaculty) return;

      deptFaculty.forEach((faculty) => {
        totalFaculty++;
        const feedback = getFacultyFeedback(faculty.id, faculty.year, faculty.sem);
        if (feedback.length > 0) {
          const stats = calculateFacultyStatistics(feedback);
          const rating =
            parseFloat(stats?.slot2?.overallAverage || stats?.slot1?.overallAverage || 0);
          totalRating += rating;
          totalResponses += feedback.length;
          facultyWithFeedback++;

          if (rating >= 4.5) distribution['Excellent']++;
          else if (rating >= 4.0) distribution['Very Good']++;
          else if (rating >= 3.5) distribution['Good']++;
          else if (rating >= 3.0) distribution['Satisfactory']++;
          else distribution['Needs Improvement']++;
        }
      });
    });

    const avgRating =
      facultyWithFeedback > 0 ? (totalRating / facultyWithFeedback).toFixed(2) : 0;
    const satisfactionRate =
      facultyWithFeedback > 0 ? (((avgRating / 5) * 100)).toFixed(1) : 0;

    return {
      distribution,
      totalFaculty,
      totalResponses,
      avgRating,
      satisfactionRate,
    };
  };

  const getSatisfactionColor = (rate) => {
    if (rate >= 90) return '#10b981';
    if (rate >= 80) return '#3b82f6';
    if (rate >= 70) return '#f59e0b';
    if (rate >= 60) return '#f97316';
    return '#ef4444';
  };



  return (
    <div className="dashboard-container">
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
          <div className="sidebar-header">
            <h3>🏛️ Navigation</h3>
          </div>

          {/* Search Bar */}
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

          {/* College Selector */}
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
              {Object.values(COLLEGES).map((college) => (
                <option key={college} value={college}>
                  {college}
                </option>
              ))}
            </select>
          </div>

          {/* Departments List */}
{selectedCollege && (
  <div className="sidebar-section">
    <h4 className="sidebar-heading">📚 Departments</h4>
    <ul className="sidebar-menu">
      {Object.keys(currentDeptStructure).map((deptCode) => {
        return (
          <li key={deptCode}>
            <button
              className={`sidebar-menu-item ${
                selectedDepartment === deptCode ? 'active' : ''
              }`}
              onClick={() => {
                setSelectedDepartment(deptCode);
                setSelectedSubDept('');
              }}
            >
              <span className="menu-icon">🏫</span>
              <span>{deptCode}</span>
            </button>
          </li>
        );
      })}
    </ul>
  </div>
)}
        </aside>

{/* Main Content Area */}
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

      {/* College Analytics Grid with Real Charts */}
      <div className="college-analytics-grid">
        {Object.values(COLLEGES).map((college) => {
          const collegeData = Object.keys(DEPT_STRUCTURE[college] || {}).map((dept) => {
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

          const maxRating = 5.0;

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

              {/* Real Graph with X and Y Axes */}
              <div className="mathematical-chart">
                <div className="chart-title">Department Satisfaction Graph</div>
                
                {/* Y-Axis */}
                <div className="chart-container">
                  <div className="y-axis">
                    <div className="y-axis-label">Rating</div>
                    <div className="y-axis-ticks">
                      {[5.0, 4.0, 3.0, 2.0, 1.0, 0].map((tick) => (
                        <div key={tick} className="y-tick">
                          <span className="y-tick-label">{tick.toFixed(1)}</span>
                          <span className="y-tick-line"></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chart Area */}
                  <div className="chart-area">
                    {/* Grid Lines */}
                    <div className="chart-grid">
                      {[5.0, 4.0, 3.0, 2.0, 1.0].map((line) => (
                        <div
                          key={line}
                          className="grid-line"
                          style={{ bottom: `${(line / maxRating) * 100}%` }}
                        />
                      ))}
                    </div>

                    {/* Bars */}
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

                {/* X-Axis */}
                <div className="x-axis">
                  <div className="x-axis-label">Departments</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual College Pie Charts */}
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
                    <span className="pie-summary-item">
                      👥 {collegeStats.totalFaculty} Faculty
                    </span>
                    <span className="pie-summary-item">
                      ⭐ {collegeStats.avgRating}/5.0 Avg
                    </span>
                  </div>
                </div>

                {/* Pie Chart Visual */}
                <div className="pie-chart-visual">
                  {[
                    { label: 'Excellent', range: [4.5, 5], color: '#10b981', emoji: '🌟' },
                    { label: 'Very Good', range: [4.0, 4.5], color: '#3b82f6', emoji: '⭐' },
                    { label: 'Good', range: [3.5, 4.0], color: '#f59e0b', emoji: '👍' },
                    { label: 'Satisfactory', range: [3.0, 3.5], color: '#f97316', emoji: '📈' },
                    { label: 'Needs Improvement', range: [0, 3.0], color: '#ef4444', emoji: '📉' },
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

                {/* Response Count */}
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
                  <h2>
                    {selectedDepartment} Department
                    {selectedSubDept && <p className="subdept-subtitle">Managing: {selectedSubDept}</p>}
                  </h2>
                </div>
                <span className="college-badge-master">{selectedCollege} College</span>
              </div>

              {/* Faculty grouped by Year/Branch */}
              {selectedDepartment === 'S&H' ? (
                // S&H: Show by Branch
                <div className="year-sections">
                  {Object.entries(groupedFaculty).map(([branch, faculties]) => (
                    <div key={branch} className="year-section">
                      <h3 className="year-section-title">
                        Branch: {branch} <span className="faculty-count">({faculties.length})</span>
                      </h3>
                      <div className="faculty-grid-master">
                        {faculties.length === 0 ? (
                          <div className="empty-state-master">
                            <span className="empty-icon-master">🧑‍🏫</span>
                            <p>No faculty found</p>
                          </div>
                        ) : (
                          faculties.map((faculty) => (
  <div
    key={faculty.id}
    className="faculty-card-compact"
    onClick={() => openFacultyModal(faculty)}
  >
    <div className="faculty-card-header-compact">
      <span className="faculty-code-badge-compact">{faculty.code}</span>
      <span className="faculty-year-badge-compact">Y{faculty.year}</span>

      {/* Admin-only remove from master list */}
      <button
        className="faculty-remove-chip"
        onClick={(e) => {
          e.stopPropagation();
          const deptKey = `${faculty.college}_${faculty.dept}`;
          removeFaculty(deptKey, faculty.id, faculty.name);
        }}
        title="Remove from Admin master list only"
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
))

                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Other Depts: Show by Year
                <div className="year-sections">
                  {Object.entries(groupedFaculty).map(([year, faculties]) => (
                    <div key={year} className="year-section">
                      <h3 className="year-section-title">
                        Year {year} <span className="faculty-count">({faculties.length})</span>
                      </h3>
                      <div className="faculty-grid-master">
                        {faculties.length === 0 ? (
                          <div className="empty-state-master">
                            <span className="empty-icon-master">🧑‍🏫</span>
                            <p>No faculty found</p>
                          </div>
                        ) : (
                          faculties.map((faculty) => (
  <div
    key={faculty.id}
    className="faculty-card-compact"
    onClick={() => openFacultyModal(faculty)}
  >
    <div className="faculty-card-header-compact">
      <span className="faculty-code-badge-compact">{faculty.code}</span>
      <span className="faculty-year-badge-compact">Y{faculty.year}</span>

      {/* Admin-only remove from master list */}
      <button
        className="faculty-remove-chip"
        onClick={(e) => {
          e.stopPropagation();
          const deptKey = `${faculty.college}_${faculty.dept}`;
         removeFaculty(deptKey, faculty.id, faculty.name);
        }}
        title="Remove from Admin master list only"
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
))

                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Faculty Detail Modal */}
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

              {!selectedFaculty.hasFeedback || !selectedFaculty.statistics ? (
                <div className="no-feedback-message">
                  <span className="no-feedback-icon">📊</span>
                  <p>No feedback data available yet</p>
                  <p className="hint">Students need to submit feedback first</p>
                </div>
              ) : (
                <>
                  {selectedFaculty.statistics.hasSlot1 && (
                    <div className="slot-stats-section">
                      <h4 className="slot-title">📋 Previous Feedback Cycle</h4>
                      <div className="stats-overview">
                        <div className="stat-box">
                          <span className="stat-number">
                            {selectedFaculty.statistics.slot1.responseCount}
                          </span>
                          <span className="stat-text">Responses</span>
                        </div>
                        <div className="stat-box highlight">
                          <span className="stat-number">
                            {selectedFaculty.statistics.slot1.overallAverage}
                          </span>
                          <span className="stat-text">Average Rating</span>
                        </div>
                      </div>

                      <div className="rating-distribution">
                        <h4>Rating Distribution</h4>
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = selectedFaculty.statistics.slot1.ratingDistribution[rating] || 0;
                          const total = Object.values(
                            selectedFaculty.statistics.slot1.ratingDistribution
                          ).reduce((a, b) => a + b, 0);
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
                          const paramStats = selectedFaculty.statistics.slot1.parameterStats[param];
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
                                <span className="param-score">{paramStats.average}/5</span>
                                <span className="param-percentage">{paramStats.percentage}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedFaculty.statistics.hasSlot2 && (
                    <div className="slot-stats-section">
                      <h4 className="slot-title">
  📋 Latest Feedback Cycle
  {selectedFaculty.statistics.hasSlot1 && selectedFaculty.statistics.hasSlot2 && (() => {
    const previous = parseFloat(selectedFaculty.statistics.slot1.overallAverage);
    const latest = parseFloat(selectedFaculty.statistics.slot2.overallAverage);
    const diff = (latest - previous).toFixed(2);
    const isImproved = diff > 0;
    const isDeclined = diff < 0;
    const isStable = diff == 0;
    
    return (
      <span 
        className={`comparison-badge ${isImproved ? 'improved' : isDeclined ? 'declined' : 'stable'}`}
        style={{
          marginLeft: '12px',
          padding: '4px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '700',
          background: isImproved ? 'rgba(16, 185, 129, 0.15)' : isDeclined ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: isImproved ? '#10b981' : isDeclined ? '#ef4444' : '#f59e0b'
        }}
      >
        {isImproved && `↑ +${diff}`}
        {isDeclined && `↓ ${diff}`}
        {isStable && '→ No Change'}
        {' from Previous'}
      </span>
    );
  })()}
</h4>

                      <div className="stats-overview">
                        <div className="stat-box">
                          <span className="stat-number">
                            {selectedFaculty.statistics.slot2.responseCount}
                          </span>
                          <span className="stat-text">Responses</span>
                        </div>
                        <div className="stat-box highlight">
                          <span className="stat-number">
                            {selectedFaculty.statistics.slot2.overallAverage}
                          </span>
                          <span className="stat-text">Average Rating</span>
                        </div>
                      </div>

                      <div className="rating-distribution">
                        <h4>Rating Distribution</h4>
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const count = selectedFaculty.statistics.slot2.ratingDistribution[rating] || 0;
                          const total = Object.values(
                            selectedFaculty.statistics.slot2.ratingDistribution
                          ).reduce((a, b) => a + b, 0);
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
                          const paramStats = selectedFaculty.statistics.slot2.parameterStats[param];
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
                                <span className="param-score">{paramStats.average}/5</span>
                                <span className="param-percentage">{paramStats.percentage}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
{/* Areas of Excellence & Improvement - Show for latest available slot */}
{(selectedFaculty.statistics.hasSlot2 || selectedFaculty.statistics.hasSlot1) && (
  <>
    {/* Determine which slot to use (prefer Slot 2, fallback to Slot 1) */}
    {(() => {
      const activeSlot = selectedFaculty.statistics.hasSlot2 
        ? selectedFaculty.statistics.slot2 
        : selectedFaculty.statistics.slot1;
      
      const topParams = getTopParameters(activeSlot?.parameterStats);
      const bottomParams = getBottomParameters(activeSlot?.parameterStats);
      
      if (topParams.length === 0 || bottomParams.length === 0) return null;
      
      return (
        <>
          {/* Areas of Excellence */}
          <div className="excellence-section">
            <h4 className="section-title">🌟 Areas of Excellence</h4>
            <div className="excellence-grid">
              {topParams.map((item, idx) => (
                <div key={item.parameter} className="excellence-card">
                  <div className="excellence-rank">#{idx + 1}</div>
                  <div className="excellence-content">
                    <span className="excellence-param">{item.parameter}</span>
                    <div className="excellence-score">
                      <span className="score-value">{item.average}/5</span>
                      <span className="score-percentage">{item.percentage}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Areas of Improvement */}
<div className="improvement-section">
  <h4 className="section-title">📈 Areas of Improvement</h4>
  <div className="improvement-grid">
    {bottomParams.map((item, idx) => {
      // Check if this parameter also appears in previous cycle's bottom 3 (Area of Concern)
      let isAreaOfConcern = false;
      if (selectedFaculty.statistics.hasSlot1 && selectedFaculty.statistics.hasSlot2) {
        const previousBottomParams = getBottomParameters(selectedFaculty.statistics.slot1.parameterStats);
        isAreaOfConcern = previousBottomParams.some(p => p.parameter === item.parameter);
      }
      
      return (
        <div 
          key={item.parameter} 
          className={`improvement-card ${isAreaOfConcern ? 'area-of-concern' : ''}`}
          style={isAreaOfConcern ? {
            border: '2px solid #ef4444',
            background: 'rgba(239, 68, 68, 0.08)'
          } : {}}
        >
          <div className="improvement-rank">
            {isAreaOfConcern ? '🚩' : `#${idx + 1}`}
          </div>
          <div className="improvement-content">
            <div style={{ flex: 1 }}>
              <span className="improvement-param">{item.parameter}</span>
              {isAreaOfConcern && (
                <div style={{
                  fontSize: '11px',
                  color: '#ef4444',
                  fontWeight: '700',
                  marginTop: '4px'
                }}>
                  🚨 Area of Concern - Needs Urgent Action
                </div>
              )}
            </div>
            <div className="improvement-score">
              <span className="score-value">{item.average}/5</span>
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

      {/* AI Statistics Modal */}
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
                      onChange={(e) => setAiStatsDept(e.target.value)}
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

                  <div className="config-section">
                    <label>Semester Comparison</label>
                    <div className="semester-options">
                      <button
                        className={`semester-btn ${selectedSemester === 'current' ? 'active' : ''}`}
                        onClick={() => setSelectedSemester('current')}
                      >
                        Current Semester
                      </button>
                      <button
                        className={`semester-btn ${selectedSemester === 'previous' ? 'active' : ''}`}
                        onClick={() => setSelectedSemester('previous')}
                      >
                        Previous Semester
                      </button>
                      <button
                        className={`semester-btn ${selectedSemester === 'both' ? 'active' : ''}`}
                        onClick={() => setSelectedSemester('both')}
                      >
                        Both (Comparison)
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn-generate-stats"
                    onClick={generateAIStatistics}
                    disabled={isGeneratingReport}
                  >
                    {isGeneratingReport ? (
                      <>
                        <span className="spinner-small" /> Analyzing Data...
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
                        ← Back to Config
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="report-header">
                        <div className="report-title-section">
                          <h2>{aiStatsData.department} Department</h2>
                          <p className="report-subtitle">
                            {selectedSemester === 'both'
                              ? 'Semester Comparison Report (Slot 1 vs Slot 2)'
                              : selectedSemester === 'current'
                              ? 'Current Semester Report (Latest Slot)'
                              : 'Previous Semester Report (Slot 1)'}
                          </p>
                          <span className="report-timestamp">
                            Generated: {aiStatsData.generatedAt}
                          </span>
                        </div>
                        <button className="btn-back-config" onClick={() => setAiStatsData(null)}>
                          ← Back to Config
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
                            {selectedSemester === 'both' && (
                              <span
                                className={`stat-change ${
                                  aiStatsData.overall.improvement > 0 ? 'positive' : 'negative'
                                }`}
                              >
                                {aiStatsData.overall.improvement > 0 ? '↑' : '↓'}{' '}
                                {Math.abs(aiStatsData.overall.improvement)} from Slot 1
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">👥</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">
                              {aiStatsData.overall.uniqueStudentResponses}
                            </span>
                            <span className="stat-label-ai">Student Responses</span>
                            <span className="stat-change neutral">
                              {aiStatsData.overall.totalFaculty} Faculty Evaluated
                            </span>
                          </div>
                        </div>

                        <div className="stat-card-ai">
                          <span className="stat-icon-ai">🎯</span>
                          <div className="stat-content-ai">
                            <span className="stat-value-ai">
                              {getPerformanceLabel(aiStatsData.overall.avgCurrentRating)}
                            </span>
                            <span className="stat-label-ai">Performance Level</span>
                            <span className="stat-change neutral">Department Average</span>
                          </div>
                        </div>
                      </div>

                      <div className="performers-section">
                        <h3>🏆 Top Performers</h3>
                        {aiStatsData.topPerformers.length === 0 ? (
                          <p className="no-performers">No performance data available</p>
                        ) : (
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
                                    ⭐ {faculty.currentRating}/5.0
                                  </span>
                                  <span className="performer-label">
                                    {getPerformanceLabel(faculty.currentRating)}
                                  </span>
                                </div>
                                <div className="performer-meter">
                                  <div
                                    className="meter-fill"
                                    style={{
                                      width: `${(faculty.currentRating / 5) * 100}%`,
                                      backgroundColor: getRatingColor(faculty.currentRating),
                                    }}
                                  />
                                </div>
                                <div className="performer-responses">
                                  {faculty.totalResponses} student responses
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="performers-section">
                        <h3>📈 Needs Improvement</h3>
                        {aiStatsData.needsImprovement.length === 0 ? (
                          <p className="no-performers">All faculty performing well</p>
                        ) : (
                          <div className="performers-grid">
                            {aiStatsData.needsImprovement.map((faculty, idx) => (
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
                                    ⭐ {faculty.currentRating}/5.0
                                  </span>
                                  <span className="performer-label">
                                    {getPerformanceLabel(faculty.currentRating)}
                                  </span>
                                </div>
                                <div className="performer-meter">
                                  <div
                                    className="meter-fill"
                                    style={{
                                      width: `${(faculty.currentRating / 5) * 100}%`,
                                      backgroundColor: getRatingColor(faculty.currentRating),
                                    }}
                                  />
                                </div>
                                <div className="performer-responses">
                                  {faculty.totalResponses} student responses
                                </div>
                                {selectedSemester === 'both' && (
                                  <div className="improvement-suggestion">
                                    {faculty.improvement > 0
                                      ? `✅ Improved by ${faculty.improvement} points`
                                      : `⚠️ Declined by ${Math.abs(faculty.improvement)} points`}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="faculty-comparison-section">
                        <h3>📊 Faculty Performance Overview</h3>
                        <div className="comparison-table">
                          <div className="comparison-header">
                            <span>Faculty</span>
                            <span>Subject</span>
                            <span>Current Rating</span>
                            {selectedSemester === 'both' && <span>Previous Rating</span>}
                            {selectedSemester === 'both' && <span>Change</span>}
                            <span>Responses</span>
                            <span>Performance</span>
                          </div>

                          {aiStatsData.facultyStats.map((faculty) => (
                            <div key={faculty.id} className="comparison-row">
                              <div className="faculty-info-compact">
                                <strong>{faculty.name}</strong>
                                <span>{faculty.code}</span>
                              </div>
                              <span className="subject-text">{faculty.subject}</span>
                              <span
                                className="rating-badge"
                                style={{ backgroundColor: getRatingColor(faculty.currentRating) }}
                              >
                                ⭐ {faculty.currentRating}
                              </span>
                              {selectedSemester === 'both' && (
                                <span className="rating-badge secondary">
                                  {faculty.previousRating}
                                </span>
                              )}
                              {selectedSemester === 'both' && (
                                <span
                                  className={`change-badge ${
                                    faculty.improvement > 0 ? 'positive' : 'negative'
                                  }`}
                                >
                                  {faculty.improvement > 0 ? '↑' : '↓'} {faculty.improvement}
                                </span>
                              )}
                              <span>{faculty.totalResponses}</span>
                              <div className="mini-meter">
                                <div
                                  className="mini-meter-fill"
                                  style={{
                                    width: `${(faculty.currentRating / 5) * 100}%`,
                                    backgroundColor: getRatingColor(faculty.currentRating),
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="report-footer">
                        <button
                          className="btn-download-ai-report"
                          onClick={() => alert('PDF generation will be implemented with backend')}
                        >
                          <span>📥</span> Download Full PDF Report
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DeveloperCredit />
    </div>
  );
};

export default AdminDashboard;
