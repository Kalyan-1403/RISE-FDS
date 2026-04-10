import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService.js';
import { sectionAPI } from '../../services/api.js';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import './HoDDashboard.css';
import { generateFacultyPDF } from '../../utils/pdfGenerator';
import { generateFacultyExcel } from '../../utils/excelGenerator';

const YEARS = ['II', 'III', 'IV'];
const SEMESTERS = ['I', 'II'];
const TWO_YEAR_DEPTS = ['M.TECH', 'MBA', 'MCA'];

// All departments per college (excluding S&H itself — used by S&H HoD to pick branches)
const BRANCHES_BY_COLLEGE = {
  Gandhi: ['CSE', 'ECE'],
  Prakasam: ['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH', 'MBA', 'MCA', 'M.TECH'],
};

const HoDDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, logoutUser } = useAuth();

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedSec, setSelectedSec] = useState('');
  const [facultyList, setFacultyList] = useState([]);
  const [newFaculty, setNewFaculty] = useState({
    name: '',
    subject: '',
    code: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);
  const [allBatches, setAllBatches] = useState([]);
  const [slotNumber, setSlotNumber] = useState(1);
  const [slotStartDate, setSlotStartDate] = useState('');
  const [slotEndDate, setSlotEndDate] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [totalStudents, setTotalStudents] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // New publish modal state (separate from configure panel)
  const [publishYear, setPublishYear] = useState('');
  const [publishSection, setPublishSection] = useState('');
  const [publishStudents, setPublishStudents] = useState('');
  // Download section state
  const [downloadYear, setDownloadYear] = useState('');
  const [downloadSection, setDownloadSection] = useState('');
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
// Section management
const [sections, setSections] = useState([]);
const [selectedSection, setSelectedSection] = useState(null);
const [selectedSHSection, setSelectedSHSection] = useState(null);
const [showSectionModal, setShowSectionModal] = useState(false);
const [sectionForm, setSectionForm] = useState({ year: 'II', sectionName: '', strength: '' });
const [sectionError, setSectionError] = useState('');
const [editingStrengthId, setEditingStrengthId] = useState(null);
const [editingStrengthVal, setEditingStrengthVal] = useState('');

  // Load data from backend
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const dashData =
        await dataService.getHoDDashboard();
      if (
        dashData.faculty &&
        dashData.faculty.length > 0
      ) {
        setFacultyList(dashData.faculty);
      }
      if (dashData.batches) {
        setAllBatches(dashData.batches);
      }
    } catch (e) {
      console.warn(
        'Backend unavailable, using cached data'
      );
    }
  }, [currentUser]);

  const loadSections = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'hod') return;
    try {
      const res = await sectionAPI.getAll();
      setSections(res.data.sections || []);
    } catch (e) {
      console.warn('Could not load sections');
    }
  }, [currentUser]);

  useEffect(() => {
    if (
      !currentUser ||
      currentUser.role !== 'hod'
    ) {
      navigate('/', { replace: true });
      return;
    }
    loadDashboardData();
    loadSections();


    // Refetch when tab regains focus
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(
        'focus',
        handleFocus
      );
    };
    }, [currentUser, navigate, loadDashboardData, loadSections]);

  const isSH = useMemo(() => {
    return currentUser?.department === 'S&H';
  }, [currentUser]);

      const availableYears = useMemo(() => {
    if (!currentUser) return YEARS;
    if (TWO_YEAR_DEPTS.includes(currentUser.department)) return ['I', 'II'];
    return YEARS;
  }, [currentUser]);

  const availableSections = useMemo(() => {
    return sections.map(s => s.sectionName);
  }, [sections]);

    // For S&H: keyed by branch. For others: keyed by year.
  const sectionsByKey = useMemo(() => {
    const map = {};
    sections.forEach(s => {
      const key = isSH ? s.branch : s.year;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sections, isSH]);

  const availableBranches = useMemo(() => {
    if (!currentUser || !isSH) return [];
    return (
      BRANCHES_BY_COLLEGE[currentUser.college] ||
      []
    );
  }, [currentUser, isSH]);

      const filteredFaculty = useMemo(() => {
    if (isSH) {
      if (!selectedBranch) return [];
      let list = facultyList.filter((f) => f.branch === selectedBranch);
      if (selectedSHSection) {
        list = list.filter((f) => f.section === selectedSHSection || f.sec === selectedSHSection);
      }
      return list;
    } else {
      let list = selectedYear
        ? facultyList.filter((f) => f.year === selectedYear)
        : facultyList;
      if (selectedSection) {
        list = list.filter((f) => f.section === selectedSection || f.sec === selectedSection);
      }
      return list;
    }
  }, [facultyList, selectedYear, selectedBranch, selectedSection, selectedSHSection, isSH]);

  const facultyByBranch = useMemo(() => {
    if (!isSH) return {};
    const grouped = {};
    availableBranches.forEach((branch) => {
      grouped[branch] = facultyList.filter(
        (f) => f.branch === branch
      );
    });
    return grouped;
  }, [facultyList, availableBranches, isSH]);

  const handleLogout = () => {
    logoutUser();
    navigate('/', { replace: true });
  };

const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) {
      setDeleteAccountError('Please enter your password to confirm');
      return;
    }
    setIsDeletingAccount(true);
    setDeleteAccountError('');
    try {
      await dataService.deleteAccount(deleteAccountPassword);
      logoutUser();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteAccountError(err.message || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };
  

  // Add or update faculty via BACKEND
  const addOrUpdateFaculty = async () => {
    const trimmedName = newFaculty.name.trim();
    const trimmedSubject =
      newFaculty.subject.trim();
    const trimmedCode = newFaculty.code.trim();

    if (
      !trimmedName ||
      !trimmedSubject ||
      !trimmedCode
    ) {
      alert('⚠️ Enter Code, Name & Subject');
      return;
    }

    const nameRegex = /^[A-Za-z\s.]+$/;
    if (!nameRegex.test(trimmedName)) {
      alert(
        '⚠️ Faculty Name must contain only letters, spaces, and dots'
      );
      return;
    }

    const subjectRegex = /^[A-Za-z\s&\-().,]+$/;
    if (!subjectRegex.test(trimmedSubject)) {
      alert(
        '⚠️ Subject must contain only letters, spaces, and basic punctuation'
      );
      return;
    }

    const codeRegex = /^[A-Za-z0-9]+$/;
    if (!codeRegex.test(trimmedCode)) {
      alert(
        '⚠️ Subject Code must be alphanumeric only'
      );
      return;
    }

    if (isSH) {
      if (!selectedBranch || !selectedSem) {
        alert('⚠️ Select Branch and Semester first');
        return;
      }
    } else {
      if (!selectedYear || !selectedSem) {
        alert('⚠️ Select Year and Semester first');
        return;
      }
    }

    const facultyData = {
      name: trimmedName,
      subject: trimmedSubject,
      code: trimmedCode.toUpperCase(),
      year: isSH ? 'I' : selectedYear,
      branch: isSH
        ? selectedBranch
        : currentUser.department,
      sem: selectedSem,
      sec: '',
      dept: currentUser.department,
      college: currentUser.college,
    };

    setIsSaving(true);

    try {
      if (editingId) {
        await dataService.updateFaculty(
          editingId,
          facultyData
        );
        setEditingId(null);
      } else {
        await dataService.createFaculty(
          facultyData
        );
      }
      // Refresh list from backend
      await loadDashboardData();
      setNewFaculty({
        name: '',
        subject: '',
        code: '',
      });
    } catch (err) {
      alert(
        `⚠️ ${err.message || 'Failed to save faculty'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const editFaculty = (f) => {
    setNewFaculty({
      name: f.name,
      subject: f.subject,
      code: f.code,
    });
    if (isSH) {
      setSelectedBranch(f.branch);
    } else {
      setSelectedYear(f.year);
    }
    setSelectedSem(f.sem);
    setSelectedSec(f.sec);
    setEditingId(f.id);
  };

  const deleteFaculty = async (id) => {
    if (!window.confirm('🗑️ Delete this faculty?'))
      return;
    try {
      await dataService.deleteFacultyById(id);
      await loadDashboardData();
    } catch (err) {
      alert(
        `⚠️ ${err.message || 'Failed to delete'}`
      );
    }
  };

const openPublishModal = () => {
    if (facultyList.length === 0) {
      alert('⚠️ Add at least one faculty member first.');
      return;
    }
    // Reset publish modal state
    setPublishYear(isSH ? 'I' : (selectedYear || ''));
    setPublishSection('');
    setPublishStudents('');
    setSelectedFacultyIds([]);
    setSlotNumber(1);
    setSlotStartDate('');
    setSlotEndDate('');
    setShowModal(true);
  };

  const toggleFacultySelection = (id) => {
    setSelectedFacultyIds((prev) =>
      prev.includes(id)
        ? prev.filter((fid) => fid !== id)
        : [...prev, id]
    );
  };

  // Publish batch via BACKEND
  const confirmPublish = async () => {
    if (selectedFacultyIds.length === 0) {
      alert('⚠️ Select at least one faculty from the right panel');
      return;
    }
    if (!publishYear) {
      alert('⚠️ Please select a Year');
      return;
    }
    if (!publishSection) {
      alert('⚠️ Please select a Section');
      return;
    }
    if (!publishStudents || parseInt(publishStudents) < 1) {
      alert('⚠️ Please enter the total number of students for this section');
      return;
    }
    if (!selectedSem) {
      alert('⚠️ Please select a Semester in the Configure Session panel first');
      return;
    }
    if (!slotStartDate || !slotEndDate) {
      alert('⚠️ Please select start and end dates for this slot');
      return;
    }
    if (new Date(slotEndDate) <= new Date(slotStartDate)) {
      alert('⚠️ End date must be after start date');
      return;
    }

    const targetYear = isSH ? 'I' : publishYear;
    const targetBranch = isSH ? selectedBranch : currentUser.department;

    setIsPublishing(true);

    try {
      const result = await dataService.createBatch({
        college: currentUser.college,
        dept: currentUser.department,
        branch: targetBranch,
        year: targetYear,
        sem: selectedSem,
        sec: publishSection,
        slot: slotNumber,
        slotStartDate: slotStartDate,
        slotEndDate: slotEndDate,
        slotLabel: slotNumber === 1 ? 'Previous Feedback Cycle' : 'Latest Feedback Cycle',
        faculty_ids: selectedFacultyIds,
        totalStudents: parseInt(publishStudents) || 0,
      });

      if (result && result.feedbackLink) {
        const fullLink = result.feedbackLink.startsWith('http')
  ? result.feedbackLink
  : `${window.location.origin}${result.feedbackLink}`;
        try {
          await navigator.clipboard.writeText(
            fullLink
          );
        } catch (e) {
          console.warn(
            'Clipboard write failed'
          );
        }

        const displayInfo = isSH
          ? `Branch ${targetBranch} • Semester ${selectedSem} • Section ${selectedSec}`
          : `Year ${targetYear} • Semester ${selectedSem} • Section ${selectedSec}`;

        alert(
          `✅ Feedback Link Published!\n\n${fullLink}\n\n📋 Link copied to clipboard!\n\n` +
            `Share this link with students of:\n${displayInfo}`
        );

        setShowModal(false);
        setSelectedFacultyIds([]);
        setSlotNumber(1);
        setSlotStartDate('');
        setSlotEndDate('');
        setPublishYear('');
        setPublishSection('');
        setPublishStudents('');

        // Refresh batches
        await loadDashboardData();
      }
    } catch (err) {
      alert(
        `⚠️ ${err.message || 'Failed to publish. Please try again.'}`
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const calculateFacultyStatistics = (
    feedbackData
  ) => {
    if (
      !feedbackData ||
      feedbackData.length === 0
    )
      return null;

    const PARAMS = [
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

    const totalResponses = feedbackData.length;
    const slot1Data = feedbackData.filter(
      (f) => f.slot === 1
    );
    const slot2Data = feedbackData.filter(
      (f) => f.slot === 2
    );

    const calculateSlotStats = (slotData) => {
      if (!slotData || slotData.length === 0)
        return null;
      const parameterStats = {};
      PARAMS.forEach((param) => {
        const ratings = slotData
          .map((f) => f.ratings[param])
          .filter((r) => r !== undefined);
        const sum = ratings.reduce(
          (a, b) => a + b,
          0
        );
        const avg =
          ratings.length > 0
            ? sum / ratings.length
            : 0;
        const percentage = (avg / 10) * 100;
        parameterStats[param] = {
          average: avg.toFixed(2),
          percentage: percentage.toFixed(1),
          totalRatings: ratings.length,
        };
      });
      const allRatings = slotData.flatMap((f) =>
        Object.values(f.ratings)
      );
      const overallAvg =
        allRatings.reduce((a, b) => a + b, 0) /
        allRatings.length;
      const ratingDist = {};
      for (let i = 1; i <= 10; i++)
        ratingDist[i] = 0;
      allRatings.forEach((r) => {
        ratingDist[r] =
          (ratingDist[r] || 0) + 1;
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

    const handleDownloadPDF = async (faculty) => {
    try {
      const stats =
        await dataService.getFacultyStats(
          faculty.id
        );
      if (!stats || stats.totalResponses === 0) {
        alert(
          '⚠️ No feedback data available for PDF.'
        );
        return;
      }
      const fileName = generateFacultyPDF(
        faculty,
        stats,
        currentUser.college
      );
      alert(`✅ PDF Downloaded: ${fileName}`);
    } catch (err) {
      console.error('PDF generation error:', err);
     alert(`⚠️ Failed to generate PDF: ${err?.message || err}`);
console.error('PDF error:', err);
    }
  };

  const handleDownloadExcel = async (faculty) => {
    try {
      const stats =
        await dataService.getFacultyStats(
          faculty.id
        );
      if (!stats || stats.totalResponses === 0) {
        alert(
          '⚠️ No feedback data available for Excel.'
        );
        return;
      }
      // Fetch raw data for the Raw Responses sheet
      let rawData = [];
      try {
        rawData =
          await dataService.getFacultyReportData(
            faculty.id
          );
      } catch (e) {
        console.warn(
          'Raw data unavailable, generating without it'
        );
      }
      const fileName = generateFacultyExcel(
        faculty,
        rawData,
        stats
      );
      alert(`✅ Excel Downloaded: ${fileName}`);
    } catch (err) {
      console.error('Excel generation error:', err);
      alert('⚠️ Failed to generate Excel.');
    }
  };

  if (!currentUser) return null;
  return (
    <>
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo-small">
              <span>RISE</span>
            </div>
            <div className="header-info">
              <h2>HoD Dashboard</h2>
              <div className="dept-badge">
                {currentUser.department} •{' '}
                {currentUser.college} College
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="user-info">
              <span className="user-icon">
                👤
              </span>
              <span>{currentUser.name}</span>
            </div>
            <button
              className="logout-btn"
              style={{ background: '#e74c3c', marginRight: '8px' }}
              onClick={() => {
                setDeleteAccountPassword('');
                setDeleteAccountError('');
                setShowDeleteAccountModal(true);
              }}
            >
              <span>🗑️ Delete Account</span>
            </button>
            <button
              className="logout-btn"
              onClick={handleLogout}
            >
              <span>Logout</span> <span>↩</span>
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="dashboard-grid">
            <section className="panel config-panel">
              <div className="panel-header">
                <h3>📝 Configure Session</h3>
              </div>

              <div className="config-form">
                <div className="form-row">
                  {isSH ? (
                    <div className="form-field">
                      <label>Branch</label>
                      <select
                        value={selectedBranch}
                        onChange={(e) =>
                          setSelectedBranch(
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select
                        </option>
                        {availableBranches.map(
                          (b) => (
                            <option
                              key={b}
                              value={b}
                            >
                              {b}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  ) : (
                    <div className="form-field">
                      <label>Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) =>
                          setSelectedYear(
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Select
                        </option>
                        {YEARS.map((y) => (
                          <option
                            key={y}
                            value={y}
                          >
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-field">
                    <label>Semester</label>
                    <select
                      value={selectedSem}
                      onChange={(e) =>
                        setSelectedSem(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select
                      </option>
                      {SEMESTERS.map((s) => (
                        <option
                          key={s}
                          value={s}
                        >
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="divider" />

                <div className="panel-header">
                  <h3>👥 Add Faculty</h3>
                </div>

                <div className="faculty-form">
                  <input
                    className="input-small"
                    type="text"
                    placeholder="Code"
                    value={newFaculty.code}
                    onChange={(e) =>
                      setNewFaculty((prev) => ({
                        ...prev,
                        code: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Name"
                    value={newFaculty.name}
                    onChange={(e) =>
                      setNewFaculty((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Subject"
                    value={newFaculty.subject}
                    onChange={(e) =>
                      setNewFaculty((prev) => ({
                        ...prev,
                        subject: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={`btn-add ${editingId ? 'btn-update' : ''}`}
                    onClick={addOrUpdateFaculty}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? 'Saving...'
                      : editingId
                        ? 'Update'
                        : 'Add'}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setEditingId(null);
                        setNewFaculty({
                          name: '',
                          subject: '',
                          code: '',
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="divider" />

                <button
                  type="button"
                  className="btn-publish"
                  onClick={openPublishModal}
                >
                  🚀 Publish Feedback Link
                </button>

                <div className="divider" />

                {/* ── Download Section ── */}
                <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '12px', border: '2px solid #86efac' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#15803d' }}>
                    📥 Download Section Responses
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <select
                      value={downloadYear}
                      onChange={(e) => setDownloadYear(e.target.value)}
                      style={{ padding: '8px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '13px', fontWeight: '600' }}
                    >
                      <option value="">Select Year</option>
                      {YEARS.map(y => <option key={y} value={y}>{y} Year</option>)}
                    </select>
                    <select
                      value={downloadSection}
                      onChange={(e) => setDownloadSection(e.target.value)}
                      style={{ padding: '8px', borderRadius: '8px', border: '1px solid #86efac', fontSize: '13px', fontWeight: '600' }}
                    >
                      <option value="">Select Section</option>
                      {availableSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (!downloadYear || !downloadSection) {
                          alert('⚠️ Select Year and Section to download');
                          return;
                        }
                        alert(`📥 Download for Year ${downloadYear} Section ${downloadSection} — format to be configured`);
                      }}
                      style={{ padding: '8px', background: 'linear-gradient(135deg,#10b981,#059669)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                    >
                      📥 Download
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel list-panel">
              <div className="panel-header">
                <h3>
                  👥 Faculty List (
                  {facultyList.length})
                </h3>
              </div>

              {isSH ? (
                <div className="sh-layout">
                  <div className="branch-sidebar">
                    <div className="sidebar-header">
                      Branches
                    </div>
                    {availableBranches.map(
                      (branch) => (
                        <button
                          key={branch}
                          type="button"
                          className={`branch-btn ${selectedBranch === branch ? 'active' : ''}`}
                          onClick={() =>
                            setSelectedBranch(
                              branch
                            )
                          }
                        >
                          <span className="branch-name">
                            {branch}
                          </span>
                          <span className="branch-count">
                            {facultyByBranch[branch]
                              ?.length || 0}
                          </span>
                        </button>
                      )
                    )}
                  </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '8px' }}>
                    {/* Section mini-tabs for selected branch */}
                    {selectedBranch && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedSHSection(null)}
                          style={{ padding: '4px 12px', borderRadius: '20px', border: '2px solid', borderColor: selectedSHSection === null ? '#ff6b9d' : '#e2e8f0', background: selectedSHSection === null ? 'linear-gradient(135deg,#ff6b9d,#feca57)' : '#f8fafc', color: selectedSHSection === null ? 'white' : '#2d3436', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                        >
                          All
                        </button>
                        {(sectionsByKey[selectedBranch] || []).map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSHSection(s.sectionName)}
                            style={{ padding: '4px 12px', borderRadius: '20px', border: '2px solid', borderColor: selectedSHSection === s.sectionName ? '#ff6b9d' : '#e2e8f0', background: selectedSHSection === s.sectionName ? 'linear-gradient(135deg,#ff6b9d,#feca57)' : '#f8fafc', color: selectedSHSection === s.sectionName ? 'white' : '#2d3436', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                          >
                            {s.sectionName}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setSectionForm(f => ({ ...f, year: 'I', branch: selectedBranch })); setSectionError(''); setShowSectionModal(true); }}
                          style={{ padding: '4px 10px', borderRadius: '20px', border: '2px dashed #48dbfb', background: '#f0fdff', color: '#0891b2', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                        >
                          + Manage
                        </button>
                      </div>
                    )}

                  <div className="faculty-list">
                    {!selectedBranch && (
                      <div className="empty-state">
                        <span className="empty-icon">
                          📚
                        </span>
                        <p>
                          Select a branch to view
                          faculty
                        </p>
                      </div>
                    )}

                    {selectedBranch &&
                      filteredFaculty.length ===
                        0 && (
                        <div className="empty-state">
                          <span className="empty-icon">
                            🧑‍🏫
                          </span>
                          <p>
                            No faculty added for{' '}
                            {selectedBranch} yet
                          </p>
                        </div>
                      )}

                    {selectedBranch &&
                      filteredFaculty.map((f) => (
                        <div
                          key={f.id}
                          className="faculty-card"
                        >
                          <div className="faculty-info">
                            <div className="faculty-code">
                              {f.code}
                            </div>
                            <div className="faculty-details">
                              <div className="faculty-name">
                                {f.name}
                              </div>
                              <div className="faculty-subject">
                                {f.subject}
                              </div>
                              <div className="faculty-badge">
                                Year {f.year} •
                                Sem {f.sem} • Sec{' '}
                                {f.sec}
                              </div>
                            </div>
                          </div>
                          <div className="faculty-actions">
                            <button
                              type="button"
                              className="btn-icon edit"
                              onClick={() =>
                                editFaculty(f)
                              }
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn-icon delete"
                              onClick={() =>
                                deleteFaculty(f.id)
                              }
                              title="Delete"
                            >
                              🗑️
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() =>
                                handleDownloadPDF(f)
                              }
                              title="Download PDF"
                              style={{
                                background:
                                  'rgba(239, 68, 68, 0.1)',
                              }}
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() =>
                                handleDownloadExcel(
                                  f
                                )
                              }
                              title="Download Excel"
                              style={{
                                background:
                                  'rgba(16, 185, 129, 0.1)',
                              }}
                            >
                              📊
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
	      </div>
              ) : (
                <>
                                    {/* Year Tabs */}
                                    <div className="year-tabs">
                    {availableYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={`tab-btn ${selectedYear === y ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedYear(y);
                          setSelectedSection(null);
                        }}
                      >
                        <span>{y} Year</span>
                        <span className="count">
                          {facultyList.filter((f) => f.year === y).length}{' '}faculty
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Section sidebar + faculty list */}
                  <div className="sh-layout" style={{ flex: 1, minHeight: 0 }}>
                    {/* Section Sidebar */}
                    <div className="branch-sidebar">
                      <div className="sidebar-header">
                        Sections
                        <button
                          type="button"
                          onClick={() => {
                            setSectionForm(f => ({ ...f, year: selectedYear || 'II' }));
                            setSectionError('');
                            setShowSectionModal(true);
                          }}
                          style={{ display: 'block', width: '100%', marginTop: '8px', padding: '6px', background: 'linear-gradient(135deg, #ff6b9d, #feca57)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '11px', cursor: 'pointer' }}
                        >
                          + Manage
                        </button>
                      </div>

                      <button
                        type="button"
                        className={`branch-btn ${selectedSection === null ? 'active' : ''}`}
                        onClick={() => setSelectedSection(null)}
                      >
                        <span className="branch-name">All</span>
                        <span className="branch-count">
                          {facultyList.filter(f => f.year === selectedYear).length}
                        </span>
                      </button>

                      {(sectionsByKey[selectedYear] || []).map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className={`branch-btn ${selectedSection === s.sectionName ? 'active' : ''}`}
                          onClick={() => setSelectedSection(s.sectionName)}
                        >
                          <span className="branch-name">{s.sectionName}</span>
                          <span className="branch-count">
                            {facultyList.filter(f => f.year === selectedYear && (f.section === s.sectionName || f.sec === s.sectionName)).length}
                          </span>
                        </button>
                      ))}

                      {(sectionsByKey[selectedYear] || []).length === 0 && (
                        <p style={{ fontSize: '11px', color: '#a0aec0', textAlign: 'center', padding: '8px' }}>
                          No sections.<br />Click Manage.
                        </p>
                      )}
                    </div>

                    {/* Faculty List */}
                    <div className="faculty-list">
                      {!selectedYear && (
                        <div className="empty-state">
                          <span className="empty-icon">📂</span>
                          <p>Select a year to view faculty</p>
                        </div>
                      )}
                      {selectedYear && filteredFaculty.length === 0 && (
                        <div className="empty-state">
                          <span className="empty-icon">🧑‍🏫</span>
                          <p>
                            {selectedSection
                              ? `No faculty in Section ${selectedSection} for Year ${selectedYear}`
                              : `No faculty added for Year ${selectedYear} yet`}
                          </p>
                        </div>
                      )}

                    {filteredFaculty.map((f) => (
                      <div
                        key={f.id}
                        className="faculty-card"
                      >
                        <div className="faculty-info">
                          <div className="faculty-code">
                            {f.code}
                          </div>
                          <div className="faculty-details">
                            <div className="faculty-name">
                              {f.name}
                            </div>
                            <div className="faculty-subject">
                              {f.subject}
                            </div>
                            <div className="faculty-badge">
                              Year {f.year} • Sem{' '}
                              {f.sem} • Sec{' '}
                              {f.sec}
                            </div>
                          </div>
                        </div>
                        <div className="faculty-actions">
                          <button
                            type="button"
                            className="btn-icon edit"
                            onClick={() =>
                              editFaculty(f)
                            }
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon delete"
                            onClick={() =>
                              deleteFaculty(f.id)
                            }
                            title="Delete"
                          >
                            🗑️
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              handleDownloadPDF(f)
                            }
                            title="Download PDF"
                            style={{
                              background:
                                'rgba(239, 68, 68, 0.1)',
                            }}
                          >
                            📄
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() =>
                              handleDownloadExcel(
                                f
                              )
                            }
                            title="Download Excel"
                            style={{
                              background:
                                'rgba(16, 185, 129, 0.1)',
                            }}
                          >
                            📊
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
		</div>
                </>
              )}
            </section>
          </div>
        </main>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '860px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <h2>🔗 Publish Feedback Link</h2>
                <p>Configure section details and select faculty for this link</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT PANEL ── */}
                <div style={{ padding: '20px', borderRight: '2px solid #e2e8f0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>📋 Section & Slot Details</h3>

                  {/* Year */}
                  {!isSH && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#374151' }}>Year</label>
                      <select
                        value={publishYear}
                        onChange={(e) => { setPublishYear(e.target.value); setSelectedFacultyIds([]); }}
                        style={{ width: '100%', padding: '9px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}
                      >
                        <option value="">Select Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y} Year</option>)}
                      </select>
                    </div>
                  )}

                  {/* Section */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#374151' }}>Section</label>
                    <select
                      value={publishSection}
                      onChange={(e) => setPublishSection(e.target.value)}
                      style={{ width: '100%', padding: '9px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}
                    >
                      <option value="">Select Section</option>
                      {availableSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                  </div>

                  {/* Student Count */}
                  {publishSection && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#374151' }}>👥 Total Students in Section {publishSection}</label>
                      <input
                        type="number" min="1" max="500"
                        value={publishStudents}
                        onChange={(e) => setPublishStudents(e.target.value)}
                        placeholder="e.g. 65"
                        style={{ width: '100%', padding: '9px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {/* Slot Selection with Locking */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#374151' }}>Select Slot</label>
                    {(() => {
                      const targetYear = isSH ? 'I' : publishYear;
                      const slot1Done = allBatches.some(b =>
                        b.year === targetYear && b.sem === selectedSem && b.sec === publishSection && b.slot === 1
                      );
                      const slot2Done = allBatches.some(b =>
                        b.year === targetYear && b.sem === selectedSem && b.sec === publishSection && b.slot === 2
                      );
                      return (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => !slot1Done && setSlotNumber(1)}
                            disabled={slot1Done}
                            style={{
                              flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: slot1Done ? 'not-allowed' : 'pointer',
                              border: slotNumber === 1 ? '2px solid #0ea5e9' : '2px solid #e2e8f0',
                              background: slot1Done ? '#e2e8f0' : slotNumber === 1 ? 'linear-gradient(135deg,#0ea5e9,#06b6d4)' : '#f8fafc',
                              color: slot1Done ? '#94a3b8' : slotNumber === 1 ? 'white' : '#2d3436',
                            }}
                          >
                            {slot1Done ? '✅ Slot 1 Done' : '📋 Slot 1 (Previous)'}
                          </button>
                          <button
                            type="button"
                            onClick={() => !slot2Done && slot1Done && setSlotNumber(2)}
                            disabled={!slot1Done || slot2Done}
                            style={{
                              flex: 1, padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px',
                              cursor: (!slot1Done || slot2Done) ? 'not-allowed' : 'pointer',
                              border: slotNumber === 2 ? '2px solid #0ea5e9' : '2px solid #e2e8f0',
                              background: slot2Done ? '#e2e8f0' : !slot1Done ? '#f8fafc' : slotNumber === 2 ? 'linear-gradient(135deg,#0ea5e9,#06b6d4)' : '#f8fafc',
                              color: (slot2Done || !slot1Done) ? '#94a3b8' : slotNumber === 2 ? 'white' : '#2d3436',
                            }}
                          >
                            {slot2Done ? '✅ Slot 2 Done' : !slot1Done ? '🔒 Slot 2 (Locked)' : '📋 Slot 2 (Latest)'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#374151' }}>Start Date</label>
                      <input type="date" value={slotStartDate} onChange={(e) => setSlotStartDate(e.target.value)}
                        style={{ width: '100%', padding: '9px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', boxSizing: 'border-box' }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#374151' }}>End Date</label>
                      <input type="date" value={slotEndDate} onChange={(e) => setSlotEndDate(e.target.value)} min={slotStartDate}
                        style={{ width: '100%', padding: '9px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', boxSizing: 'border-box' }} required />
                    </div>
                  </div>

                  {slotStartDate && slotEndDate && (
                    <div style={{ padding: '8px 12px', background: 'rgba(14,165,233,0.1)', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#0369a1' }}>
                      ℹ️ Active from {new Date(slotStartDate).toLocaleDateString()} to {new Date(slotEndDate).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* ── RIGHT PANEL ── */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>
                    👥 Select Faculty
                    {publishYear && <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginLeft: '8px' }}>(Year {publishYear})</span>}
                  </h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
                    {selectedFacultyIds.length} selected
                  </p>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const filtered = facultyList.filter(f => {
  if (isSH) return f.branch === selectedBranch;
  return publishYear ? f.year === publishYear : true;
});
                      if (filtered.length === 0) return (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          <div style={{ fontSize: '30px', marginBottom: '8px' }}>🧑‍🏫</div>
                          <p style={{ fontSize: '13px' }}>No faculty found for selected year/semester</p>
                        </div>
                      );
                      return filtered.map(faculty => (
                        <div
                          key={faculty.id}
                          onClick={() => {
                            setSelectedFacultyIds(prev =>
                              prev.includes(faculty.id) ? prev.filter(id => id !== faculty.id) : [...prev, faculty.id]
                            );
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                            borderRadius: '10px', cursor: 'pointer', border: '2px solid',
                            borderColor: selectedFacultyIds.includes(faculty.id) ? '#0ea5e9' : '#e2e8f0',
                            background: selectedFacultyIds.includes(faculty.id) ? 'rgba(14,165,233,0.08)' : '#f8fafc',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input type="checkbox" checked={selectedFacultyIds.includes(faculty.id)} onChange={() => {}} style={{ accentColor: '#0ea5e9' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>{faculty.name}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{faculty.code} • {faculty.subject}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Year {faculty.year} • Sem {faculty.sem}</div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-confirm" onClick={confirmPublish} disabled={isPublishing}>
                  {isPublishing ? '⏳ Publishing...' : '✅ Confirm & Publish'}
                </button>
                <button className="btn-modal-cancel" onClick={() => setShowModal(false)}>
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      {/* ── Manage Sections Modal ── */}
      {showSectionModal && (
        <div className="modal-overlay" onClick={() => setShowSectionModal(false)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Sections</h2>
              <p>Add or remove sections per year. Click 💪 to edit strength inline.</p>
            </div>
            <div className="modal-body">
                            {isSH ? (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#636e72', display: 'block', marginBottom: '6px' }}>Department (Branch)</label>
                  <select
                    value={sectionForm.branch || ''}
                    onChange={e => setSectionForm(f => ({ ...f, branch: e.target.value, year: 'I' }))}
                    style={{ width: '100%', padding: '9px 10px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: '#f8fafc' }}
                  >
                    <option value="">Select Department</option>
                    {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#636e72', display: 'block', marginBottom: '6px' }}>Select Year</label>
                  <select
                    value={sectionForm.year}
                    onChange={e => setSectionForm(f => ({ ...f, year: e.target.value }))}
                    style={{ width: '100%', padding: '9px 10px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', background: '#f8fafc' }}
                  >
                    {availableYears.map(yr => <option key={yr} value={yr}>Year {yr}</option>)}
                  </select>
                </div>
              )}

                            {(sectionsByKey[isSH ? (sectionForm.branch || '') : sectionForm.year] || []).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: '#2d3436' }}>
                    Existing Sections — {isSH ? `${sectionForm.branch} Dept` : `Year ${sectionForm.year}`}
                  </p>
                  {(sectionsByKey[isSH ? (sectionForm.branch || '') : sectionForm.year] || []).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px', border: '2px solid #e2e8f0' }}>
                      <span style={{ fontWeight: '800', color: '#ff6b9d', flex: 1 }}>{s.sectionName}</span>
                      {editingStrengthId === s.id ? (
                        <input
                          type="number"
                          value={editingStrengthVal}
                          onChange={e => setEditingStrengthVal(e.target.value)}
                          style={{ width: '70px', padding: '4px 8px', border: '2px solid #ff6b9d', borderRadius: '6px', fontWeight: '700', fontSize: '13px' }}
                          autoFocus
                        />
                      ) : (
                        <span
                          title="Click to edit strength"
                          onClick={() => { setEditingStrengthId(s.id); setEditingStrengthVal(String(s.strength)); }}
                          style={{ cursor: 'pointer', padding: '4px 10px', background: '#ffeaa7', borderRadius: '6px', fontWeight: '700', fontSize: '13px' }}
                        >
                          💪 {s.strength}
                        </span>
                      )}
                      {editingStrengthId === s.id && (
                        <button
                          type="button"
                          onClick={async () => {
                            await sectionAPI.update(s.id, { strength: Number(editingStrengthVal) });
                            setSections(prev => prev.map(x => x.id === s.id ? { ...x, strength: Number(editingStrengthVal) } : x));
                            setEditingStrengthId(null);
                          }}
                          style={{ padding: '4px 10px', background: '#48dbfb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                        >✓</button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete section "${s.sectionName}"?`)) return;
                          await sectionAPI.delete(s.id);
                          setSections(prev => prev.filter(x => x.id !== s.id));
                          if (isSH) { if (selectedSHSection === s.sectionName) setSelectedSHSection(null); }
else { if (selectedSection === s.sectionName) setSelectedSection(null); }
                        }}
                        style={{ padding: '4px 10px', background: '#ff6b9d', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                      >🗑</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: '14px', background: '#f0fff4', borderRadius: '10px', border: '2px solid #48dbfb' }}>
                <p style={{ fontWeight: '700', fontSize: '13px', marginBottom: '10px', color: '#2d3436' }}>Add New Section</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#636e72' }}>Section Name</label>
                    <input
                      type="text"
                      placeholder="e.g. A, B, CSE-DS, AI&ML"
                      value={sectionForm.sectionName}
                      onChange={e => setSectionForm(f => ({ ...f, sectionName: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#636e72' }}>Strength</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={sectionForm.strength}
                      onChange={e => setSectionForm(f => ({ ...f, strength: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                    />
                  </div>
                </div>
                {sectionError && <p style={{ color: '#ff6b9d', fontSize: '12px', fontWeight: '700', marginBottom: '8px' }}>{sectionError}</p>}
                <button
                  type="button"
                  onClick={async () => {
                    setSectionError('');
                                        if (isSH && !sectionForm.branch) { setSectionError('Select a department first'); return; }
                    if (!sectionForm.sectionName.trim()) { setSectionError('Section name is required'); return; }
                    try {
                                            const res = await sectionAPI.create({
                        year: isSH ? 'I' : sectionForm.year,
                        branch: isSH ? (sectionForm.branch || '') : '',
                        sectionName: sectionForm.sectionName.trim(),
                        strength: Number(sectionForm.strength) || 0,
                      });
                      setSections(prev => [...prev, res.data.section]);
                      setSectionForm(f => ({ ...f, sectionName: '', strength: '' }));
                    } catch (err) {
                      setSectionError(err.response?.data?.error || 'Failed to add section');
                    }
                  }}
                  style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #ff6b9d, #feca57)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
                >
                  + Add Section
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setShowSectionModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}


{showDeleteAccountModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: '420px' }}>
              <div className="modal-header">
                <h3>🗑️ Delete Account</h3>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{
                  background: '#FFF3CD', border: '1px solid #FFC107',
                  borderRadius: '8px', padding: '12px 16px',
                  marginBottom: '16px', fontSize: '13px', color: '#856404',
                }}>
                  ⚠️ This will permanently delete your account for <strong>{currentUser.department} — {currentUser.college}</strong>. This cannot be undone. A new HoD can register for this department afterward.
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>
                    Confirm your password to proceed:
                  </label>
                  <input
                    type="password"
                    value={deleteAccountPassword}
                    onChange={(e) => { setDeleteAccountPassword(e.target.value); setDeleteAccountError(''); }}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                {deleteAccountError && (
                  <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '12px', fontWeight: 'bold' }}>
                    ⚠️ {deleteAccountError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount}
                    style={{
                      flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
                      fontWeight: 'bold', fontSize: '14px',
                      background: isDeletingAccount ? '#ccc' : '#e74c3c',
                      color: '#fff', cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDeletingAccount ? 'Deleting...' : '🗑️ Yes, Delete My Account'}
                  </button>
                  <button
                    onClick={() => setShowDeleteAccountModal(false)}
                    disabled={isDeletingAccount}
                    style={{ flex: 1, padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DeveloperCredit />
      </div>
    </>
  );
};

export default HoDDashboard;