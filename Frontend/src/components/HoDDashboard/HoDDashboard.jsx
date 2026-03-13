import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService.js';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import './HoDDashboard.css';
import { generateFacultyPDF } from '../../utils/pdfGenerator';
import { generateFacultyExcel } from '../../utils/excelGenerator';

const YEARS = ['II', 'III', 'IV'];
const SEMESTERS = ['I', 'II'];

const BRANCHES_BY_COLLEGE = {
  Gandhi: ['CSE', 'ECE'],
  Prakasam: [
    'CSE', 'ECE', 'EEE', 'CIVIL', 'MECH',
  ],
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
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (
      !currentUser ||
      currentUser.role !== 'hod'
    ) {
      navigate('/', { replace: true });
      return;
    }
    loadDashboardData();

    // Refetch when tab regains focus
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(
        'focus',
        handleFocus
      );
    };
  }, [currentUser, navigate, loadDashboardData]);

  const isSH = useMemo(() => {
    return currentUser?.department === 'S&H';
  }, [currentUser]);

  const availableSections = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.department === 'CSE') {
      return ['1', '2', 'DS', 'AI&ML'];
    }
    return ['1', '2', '3'];
  }, [currentUser]);

  const availableBranches = useMemo(() => {
    if (!currentUser || !isSH) return [];
    return (
      BRANCHES_BY_COLLEGE[currentUser.college] ||
      []
    );
  }, [currentUser, isSH]);

  const filteredFaculty = useMemo(() => {
    if (isSH) {
      return selectedBranch
        ? facultyList.filter(
            (f) => f.branch === selectedBranch
          )
        : [];
    } else {
      return selectedYear
        ? facultyList.filter(
            (f) => f.year === selectedYear
          )
        : facultyList;
    }
  }, [
    facultyList,
    selectedYear,
    selectedBranch,
    isSH,
  ]);

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
      if (
        !selectedBranch ||
        !selectedSem ||
        !selectedSec
      ) {
        alert(
          '⚠️ Select Branch, Semester & Section first'
        );
        return;
      }
    } else {
      if (
        !selectedYear ||
        !selectedSem ||
        !selectedSec
      ) {
        alert(
          '⚠️ Select Year, Semester & Section first'
        );
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
      sec: selectedSec,
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
      alert(
        '⚠️ Add at least one faculty member first.'
      );
      return;
    }

    if (isSH && !selectedBranch) {
      alert('⚠️ Please select a Branch first');
      return;
    }
    if (!isSH && !selectedYear) {
      alert('⚠️ Please select a Year first');
      return;
    }
    if (!selectedSem) {
      alert(
        '⚠️ Please select a Semester first'
      );
      return;
    }
    if (!selectedSec) {
      alert(
        '⚠️ Please select a Section first'
      );
      return;
    }

    // Filter faculty matching current selection
    const matchingFaculty =
      facultyList.filter((f) => {
        if (isSH) {
          return (
            f.branch === selectedBranch &&
            f.sem === selectedSem &&
            f.sec === selectedSec
          );
        }
        return (
          f.year === selectedYear &&
          f.sem === selectedSem &&
          f.sec === selectedSec
        );
      });

    if (matchingFaculty.length === 0) {
      const label = isSH
        ? `Branch ${selectedBranch}`
        : `Year ${selectedYear}`;
      alert(
        `⚠️ No faculty found for ${label}, ` +
          `Sem ${selectedSem}, ` +
          `Sec ${selectedSec}`
      );
      return;
    }

    setSelectedFacultyIds(
      matchingFaculty.map((f) => f.id)
    );
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
      alert('⚠️ Select at least one faculty');
      return;
    }

    if (!selectedSem || !selectedSec) {
      alert(
        '⚠️ Please select Semester and Section in the Configure Session panel first'
      );
      return;
    }

    if (isSH && !selectedBranch) {
      alert('⚠️ Please select a Branch first');
      return;
    }

    if (!isSH && !selectedYear) {
      alert('⚠️ Please select a Year first');
      return;
    }

    if (!slotStartDate || !slotEndDate) {
      alert(
        '⚠️ Please select start and end dates for this slot'
      );
      return;
    }

    if (
      new Date(slotEndDate) <=
      new Date(slotStartDate)
    ) {
      alert(
        '⚠️ End date must be after start date'
      );
      return;
    }

    const targetYear = isSH ? 'I' : selectedYear;
    const targetBranch = isSH
      ? selectedBranch
      : currentUser.department;

    setIsPublishing(true);

    try {
      const result =
        await dataService.createBatch({
          college: currentUser.college,
          dept: currentUser.department,
          branch: targetBranch,
          year: targetYear,
          sem: selectedSem,
          sec: selectedSec,
          slot: slotNumber,
          slotStartDate: slotStartDate,
          slotEndDate: slotEndDate,
          slotLabel:
            slotNumber === 1
              ? 'Previous Feedback Cycle'
              : 'Latest Feedback Cycle',
          faculty_ids: selectedFacultyIds,
        });

      if (result && result.feedbackLink) {
        const fullLink = `${window.location.origin}${result.feedbackLink}`;
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
                  <div className="form-field">
                    <label>Section</label>
                    <select
                      value={selectedSec}
                      onChange={(e) =>
                        setSelectedSec(
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        Select
                      </option>
                      {availableSections.map(
                        (sec) => (
                          <option
                            key={sec}
                            value={sec}
                          >
                            {sec}
                          </option>
                        )
                      )}
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
              ) : (
                <>
                  <div className="year-tabs">
                    {YEARS.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={`tab-btn ${selectedYear === y ? 'active' : ''}`}
                        onClick={() =>
                          setSelectedYear(y)
                        }
                      >
                        <span>{y} Year</span>
                        <span className="count">
                          {
                            facultyList.filter(
                              (f) =>
                                f.year === y
                            ).length
                          }{' '}
                          faculty
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="faculty-list">
                    {selectedYear === '' &&
                      facultyList.length === 0 && (
                        <div className="empty-state">
                          <span className="empty-icon">
                            📂
                          </span>
                          <p>
                            Select a year to view
                            faculty
                          </p>
                        </div>
                      )}

                    {selectedYear !== '' &&
                      filteredFaculty.length ===
                        0 && (
                        <div className="empty-state">
                          <span className="empty-icon">
                            🧑‍🏫
                          </span>
                          <p>
                            No faculty added for
                            Year {selectedYear}{' '}
                            yet
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
                </>
              )}
            </section>
          </div>
        </main>

        {showModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="modal-content"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modal-header">
                <h2>
                  🔗 Publish Feedback Link
                </h2>
                <p>
                  Configure slot details and
                  select faculty members
                </p>
              </div>

              <div className="modal-body">
                <div
                  style={{
                    padding: '16px',
                    background:
                      'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border:
                      '2px solid #0ea5e9',
                  }}
                >
                  <h3
                    style={{
                      margin: '0 0 16px 0',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#0c4a6e',
                    }}
                  >
                    📅 Slot Configuration
                  </h3>

                  <div
                    style={{
                      marginBottom: '16px',
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: '700',
                        marginBottom: '8px',
                        color: '#2d3436',
                      }}
                    >
                      Select Slot
                    </label>
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSlotNumber(1)
                        }
                        style={{
                          flex: 1,
                          padding: '12px',
                          border:
                            slotNumber === 1
                              ? '2px solid #0ea5e9'
                              : '2px solid #e2e8f0',
                          borderRadius: '10px',
                          background:
                            slotNumber === 1
                              ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)'
                              : '#f8fafc',
                          color:
                            slotNumber === 1
                              ? 'white'
                              : '#2d3436',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        📋 Slot 1 (Previous)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSlotNumber(2)
                        }
                        style={{
                          flex: 1,
                          padding: '12px',
                          border:
                            slotNumber === 2
                              ? '2px solid #0ea5e9'
                              : '2px solid #e2e8f0',
                          borderRadius: '10px',
                          background:
                            slotNumber === 2
                              ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)'
                              : '#f8fafc',
                          color:
                            slotNumber === 2
                              ? 'white'
                              : '#2d3436',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        📋 Slot 2 (Latest)
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        '1fr 1fr',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '700',
                          marginBottom: '6px',
                          color: '#2d3436',
                        }}
                      >
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={slotStartDate}
                        onChange={(e) =>
                          setSlotStartDate(
                            e.target.value
                          )
                        }
                        style={{
                          width: '100%',
                          padding: '10px',
                          border:
                            '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                        }}
                        required
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: '700',
                          marginBottom: '6px',
                          color: '#2d3436',
                        }}
                      >
                        End Date
                      </label>
                      <input
                        type="date"
                        value={slotEndDate}
                        onChange={(e) =>
                          setSlotEndDate(
                            e.target.value
                          )
                        }
                        min={slotStartDate}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border:
                            '2px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: '600',
                        }}
                        required
                      />
                    </div>
                  </div>

                  {slotStartDate &&
                    slotEndDate && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '8px 12px',
                          background:
                            'rgba(14, 165, 233, 0.1)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#0369a1',
                        }}
                      >
                        ℹ️ This slot will be
                        active from{' '}
                        {new Date(
                          slotStartDate
                        ).toLocaleDateString()}{' '}
                        to{' '}
                        {new Date(
                          slotEndDate
                        ).toLocaleDateString()}
                      </div>
                    )}
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border:
                      '2px solid #e2e8f0',
                  }}
                >
                  <div className="section-header">
                    <h3>
                      👥 Select Faculty Members
                    </h3>
                     <p>
                      {selectedFacultyIds.length}{' '}
                      of{' '}
                      {facultyList.filter((f) => {
                        if (isSH) return f.branch === selectedBranch && f.sem === selectedSem && f.sec === selectedSec;
                        return f.year === selectedYear && f.sem === selectedSem && f.sec === selectedSec;
                      }).length}{' '}
                      selected
                    </p>
                  </div>

                                    {facultyList
                    .filter((f) => {
                      if (isSH) {
                        return (
                          f.branch ===
                            selectedBranch &&
                          f.sem ===
                            selectedSem &&
                          f.sec === selectedSec
                        );
                      }
                      return (
                        f.year ===
                          selectedYear &&
                        f.sem ===
                          selectedSem &&
                        f.sec === selectedSec
                      );
                    })
                    .map((faculty) => (
                      <div
                        key={faculty.id}
                        className="checkbox-card"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFacultyIds.includes(
                            faculty.id
                          )}
                          onChange={() =>
                            toggleFacultySelection(
                              faculty.id
                            )
                          }
                        />
                        <div className="checkbox-content">
                          <span className="checkbox-code">
                            {faculty.code}
                          </span>
                          <div>
                            <div className="checkbox-name">
                              {faculty.name}
                            </div>
                            <div className="checkbox-subject">
                              {faculty.subject}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn-confirm"
                  onClick={confirmPublish}
                  disabled={isPublishing}
                >
                  {isPublishing
                    ? '⏳ Publishing...'
                    : '✅ Confirm & Publish'}
                </button>
                <button
                  className="btn-modal-cancel"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  ❌ Cancel
                </button>
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