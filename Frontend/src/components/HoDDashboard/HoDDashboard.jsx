import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
const BRANCHES_BY_COLLEGE = {
  Gandhi: ['CSE', 'ECE'],
  Prakasam: ['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH', 'MBA', 'MCA', 'M.TECH'],
};

/* ─────────────────────────────────────────────
   Toast helper
───────────────────────────────────────────── */
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

const HoDDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser, logoutUser } = useAuth();

  /* ── Core ── */
  const [facultyList, setFacultyList] = useState([]);
  const [allBatches, setAllBatches] = useState([]);

  /* ── Faculty pool form ── */
  const [newFacultyName, setNewFacultyName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ── Section state ── */
  const [sections, setSections] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedSHSection, setSelectedSHSection] = useState(null);

  /* ── Section editing (sidebar quick edit) ── */
  const [editingSection, setEditingSection] = useState(null); // { id, name, strength }
  const [editSectionName, setEditSectionName] = useState('');
  const [editSectionStrength, setEditSectionStrength] = useState('');

  /* ── Manage Sections Modal ── */
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionForm, setSectionForm] = useState({ key: null, sectionName: '', strength: '', applyAll: false });
  const [sectionError, setSectionError] = useState('');
  // strength-only inline edit inside modal
  const [editingStrengthId, setEditingStrengthId] = useState(null);
  const [editingStrengthVal, setEditingStrengthVal] = useState('');

  /* ── Assign Faculty Modal (multi-step) ── */
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStep, setAssignStep] = useState(1);
  const [assignYear, setAssignYear] = useState('');
  const [assignSem, setAssignSem] = useState('');
  const [assignSubjectCount, setAssignSubjectCount] = useState(1);
  const [assignSubjectNames, setAssignSubjectNames] = useState(['']);
  const [assignRows, setAssignRows] = useState([]); // [{subjectName, section, facultyId}]
  const [isAssigning, setIsAssigning] = useState(false);

  /* ── Publish Modal ── */
  const [showModal, setShowModal] = useState(false);
  const [publishStep, setPublishStep] = useState(1); // 1: config, 2: review
  const [publishYear, setPublishYear] = useState('');
  const [publishSem, setPublishSem] = useState('');
  const [publishSection, setPublishSection] = useState('');
  const [publishStudents, setPublishStudents] = useState('');
  const [slotNumber, setSlotNumber] = useState(1);
  const [slotStartDate, setSlotStartDate] = useState('');
  const [slotEndDate, setSlotEndDate] = useState('');
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);

  /* ── Download ── */
  const [downloadYear, setDownloadYear] = useState('');
  const [downloadSection, setDownloadSection] = useState('');

  /* ── Delete account ── */
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  /* ── Toast ── */
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const showToast = useCallback((message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  }, []);

  /* ────────────────────────────────────────
     Data loading
  ──────────────────────────────────────── */
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const dashData = await dataService.getHoDDashboard();
      if (dashData.faculty?.length > 0) setFacultyList(dashData.faculty);
      if (dashData.batches) setAllBatches(dashData.batches);
    } catch (e) {
      console.warn('Backend unavailable, using cached data');
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
    if (!currentUser || currentUser.role !== 'hod') {
      navigate('/', { replace: true });
      return;
    }
    loadDashboardData();
    loadSections();

    // Live refresh every 30s + on focus
    const interval = setInterval(loadDashboardData, 30000);
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser, navigate, loadDashboardData, loadSections]);

  /* ────────────────────────────────────────
     Memos
  ──────────────────────────────────────── */
  const isSH = useMemo(() => currentUser?.department === 'S&H', [currentUser]);

  const availableYears = useMemo(() => {
    if (!currentUser) return YEARS;
    return TWO_YEAR_DEPTS.includes(currentUser.department) ? ['I', 'II'] : YEARS;
  }, [currentUser]);

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
    if (!isSH) return [];
    return BRANCHES_BY_COLLEGE[currentUser?.college] || [];
  }, [currentUser, isSH]);

  const globalFacultyPool = useMemo(
    () => facultyList.filter(f => !f.year || f.year === ''),
    [facultyList]
  );
  const assignedFaculty = useMemo(
    () => facultyList.filter(f => f.year && f.year !== ''),
    [facultyList]
  );

  const filteredFaculty = useMemo(() => {
    if (isSH) {
      if (!selectedBranch) return [];
      let list = assignedFaculty.filter(f => f.branch === selectedBranch);
      if (selectedSHSection) list = list.filter(f => f.section === selectedSHSection || f.sec === selectedSHSection);
      return list;
    }
    let list = selectedYear ? assignedFaculty.filter(f => f.year === selectedYear) : assignedFaculty;
    if (selectedSection) list = list.filter(f => f.section === selectedSection || f.sec === selectedSection);
    return list;
  }, [assignedFaculty, selectedYear, selectedBranch, selectedSection, selectedSHSection, isSH]);

  // Only sections with complete responses (for download - Req 9)
  const downloadSections = useMemo(() => {
    if (!downloadYear) return [];
    const secs = sectionsByKey[downloadYear] || [];
    return secs.filter(s => {
      const batch = allBatches.find(b => b.year === downloadYear && (b.sec === s.sectionName || b.section === s.sectionName));
      return batch && batch.totalStudents > 0 && (batch.responseCount || 0) >= batch.totalStudents;
    });
  }, [downloadYear, sectionsByKey, allBatches]);

  // Faculty for selected publish section (step 2)
  const publishSectionFaculty = useMemo(() => {
    return assignedFaculty.filter(f => {
      const matchBranch = isSH ? f.branch === selectedBranch : f.year === publishYear;
      const matchSem = f.sem === publishSem || f.semester === publishSem;
      const matchSec = f.section === publishSection || f.sec === publishSection;
      return matchBranch && matchSem && matchSec;
    });
  }, [assignedFaculty, isSH, selectedBranch, publishYear, publishSem, publishSection]);

  /* ────────────────────────────────────────
     Handlers — Faculty Pool
  ──────────────────────────────────────── */
  const addOrUpdateFaculty = async () => {
    const trimmed = newFacultyName.trim();
    if (!trimmed) {
      showToast('Faculty name cannot be empty. Please enter a name.');
      return;
    }
    if (!/^[A-Za-z\s.]+$/.test(trimmed)) {
      showToast('Faculty name must contain only letters, spaces, and dots.');
      return;
    }
    
    // Auto-generate a code from initials
    const autoCode = trimmed.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 5);
    
    const facultyData = {
      name: trimmed,
      // PATCH: Send a 3-character placeholder to bypass backend validation
      subject: 'TBD', 
      code: autoCode,
      year: '',
      branch: isSH ? (selectedBranch || '') : currentUser.department,
      sem: '',
      sec: '',
      dept: currentUser.department,
      college: currentUser.college,
    };

    setIsSaving(true);
    try {
      if (editingId) {
        await dataService.updateFaculty(editingId, facultyData);
        setEditingId(null);
        showToast('Faculty updated successfully.', 'success');
      } else {
        await dataService.createFaculty(facultyData);
        showToast(`${trimmed} added to pool.`, 'success');
      }
      await loadDashboardData();
      setNewFacultyName('');
    } catch (err) {
      showToast(err.message || 'Failed to save faculty. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFaculty = async (id) => {
    if (!window.confirm('Remove this faculty entry? This cannot be undone.')) return;
    try {
      await dataService.deleteFacultyById(id);
      await loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to delete faculty.');
    }
  };

  /* ────────────────────────────────────────
     Handlers — Assign Modal (multi-step)
  ──────────────────────────────────────── */
  const openAssignModal = () => {
    if (globalFacultyPool.length === 0) {
      showToast('Add faculty to the pool first before assigning.');
      return;
    }
    setAssignStep(1);
    setAssignYear('');
    setAssignSem('');
    setAssignSubjectCount(1);
    setAssignSubjectNames(['']);
    setAssignRows([]);
    setShowAssignModal(true);
  };

  const handleAssignStep1 = () => {
    if (!isSH && !assignYear) { showToast('Please select a Year to continue.'); return; }
    if (!assignSem) { showToast('Please select a Semester to continue.'); return; }
    setAssignStep(2);
  };

  const handleAssignStep2 = () => {
    const subjectRegex = /^[A-Za-z\s&\-().,0-9]+$/;
    const valid = assignSubjectNames.map(s => s.trim()).filter(Boolean);
    if (valid.length === 0) { showToast('Enter at least one subject name.'); return; }
    for (const s of valid) {
      if (!subjectRegex.test(s)) {
        showToast(`"${s}" has invalid characters. Use letters, numbers, spaces, &, -, (, ), . only.`);
        return;
      }
    }
    setAssignRows(valid.map(s => ({ subjectName: s, section: '', facultyId: '' })));
    setAssignStep(3);
  };

  const handleAssignFaculty = async () => {
    for (const row of assignRows) {
      if (!row.section) { showToast('Please select a section for every subject.'); return; }
      if (!row.facultyId) { showToast('Please select a faculty for every subject.'); return; }
    }
    setIsAssigning(true);
    try {
      for (const row of assignRows) {
        const faculty = globalFacultyPool.find(f => f.id === row.facultyId);
        if (!faculty) continue;
        await dataService.createFaculty({
          name: faculty.name,
          subject: row.subjectName,
          code: faculty.code,
          year: isSH ? 'I' : assignYear,
          branch: isSH ? selectedBranch : currentUser.department,
          sem: assignSem,
          sec: row.section,
          dept: currentUser.department,
          college: currentUser.college,
        });
      }
      await loadDashboardData();
      showToast('Faculty assigned successfully!', 'success');
      setShowAssignModal(false);
    } catch (err) {
      showToast(err.message || 'Failed to assign faculty. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  /* ────────────────────────────────────────
     Handlers — Publish Modal
  ──────────────────────────────────────── */
  const openPublishModal = () => {
    if (assignedFaculty.length === 0) {
      showToast('No faculty assigned yet. Assign faculty to sections before publishing.');
      return;
    }
    setPublishStep(1);
    setPublishYear(isSH ? 'I' : '');
    setPublishSem('');
    setPublishSection('');
    setPublishStudents('');
    setSlotNumber(1);
    setSlotStartDate('');
    setSlotEndDate('');
    setSelectedFacultyIds([]);
    setShowModal(true);
  };

  const handlePublishProceed = () => {
    if (!publishSem) { showToast('Please select a Semester.'); return; }
    if (!isSH && !publishYear) { showToast('Please select a Year.'); return; }
    if (!publishSection) { showToast('Please select a Section.'); return; }
    if (!slotStartDate || !slotEndDate) { showToast('Please select both start and end dates.'); return; }
    if (new Date(slotEndDate) <= new Date(slotStartDate)) { showToast('End date must be after start date.'); return; }
    if (publishSectionFaculty.length === 0) {
      showToast('No faculty assigned to this section for the selected semester. Please assign faculty first.');
      return;
    }
    setSelectedFacultyIds(publishSectionFaculty.map(f => f.id));
    setPublishStep(2);
  };

  const confirmPublish = async () => {
    if (selectedFacultyIds.length === 0) {
      showToast('Select at least one faculty to include in this feedback link.');
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
        sem: publishSem,
        sec: publishSection,
        slot: slotNumber,
        slotStartDate,
        slotEndDate,
        slotLabel: slotNumber === 1 ? 'Previous Feedback Cycle' : 'Latest Feedback Cycle',
        faculty_ids: selectedFacultyIds,
        totalStudents: parseInt(publishStudents) || 0,
      });
      if (result?.feedbackLink) {
        const fullLink = result.feedbackLink.startsWith('http')
          ? result.feedbackLink
          : `${window.location.origin}${result.feedbackLink}`;
        try { await navigator.clipboard.writeText(fullLink); } catch (_) {}
        showToast('Feedback link published and copied to clipboard!', 'success');
        setShowModal(false);
        await loadDashboardData();
      }
    } catch (err) {
      showToast(err.message || 'Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  /* ────────────────────────────────────────
     Handlers — Section sidebar quick-edit
  ──────────────────────────────────────── */
  const startEditSection = (s) => {
    setEditingSection(s.id);
    setEditSectionName(s.sectionName);
    setEditSectionStrength(String(s.strength || 0));
  };

  const saveEditSection = async (id) => {
    if (!editSectionName.trim()) { showToast('Section name cannot be empty.'); return; }
    try {
      await sectionAPI.update(id, { sectionName: editSectionName.trim(), strength: Number(editSectionStrength) || 0 });
      setSections(prev => prev.map(x => x.id === id
        ? { ...x, sectionName: editSectionName.trim(), strength: Number(editSectionStrength) || 0 }
        : x));
      if (selectedSection === sections.find(s => s.id === id)?.sectionName) {
        setSelectedSection(editSectionName.trim());
      }
      setEditingSection(null);
    } catch (err) {
      showToast('Failed to update section.');
    }
  };

  /* ────────────────────────────────────────
     Handlers — Download / PDF / Excel
  ──────────────────────────────────────── */
  const handleDownloadPDF = async (faculty) => {
    try {
      const stats = await dataService.getFacultyStats(faculty.id);
      if (!stats || stats.totalResponses === 0) { showToast('No feedback data available to generate PDF.'); return; }
      const fileName = generateFacultyPDF(faculty, stats, currentUser.college);
      showToast(`PDF downloaded: ${fileName}`, 'success');
    } catch (err) {
      showToast(`Failed to generate PDF: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleDownloadExcel = async (faculty) => {
    try {
      const stats = await dataService.getFacultyStats(faculty.id);
      if (!stats || stats.totalResponses === 0) { showToast('No feedback data available to generate Excel.'); return; }
      let rawData = [];
      try { rawData = await dataService.getFacultyReportData(faculty.id); } catch (_) {}
      const fileName = generateFacultyExcel(faculty, rawData, stats);
      showToast(`Excel downloaded: ${fileName}`, 'success');
    } catch (err) {
      showToast('Failed to generate Excel report.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) { setDeleteAccountError('Password is required to proceed.'); return; }
    setIsDeletingAccount(true);
    setDeleteAccountError('');
    try {
      await dataService.deleteAccount(deleteAccountPassword);
      logoutUser();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteAccountError(err.message || 'Failed to delete account. Check your password and try again.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (!currentUser) return null;

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <>
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'error' })} />

      <div className="dashboard-container">

        {/* ── Header ── */}
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo-small"><span>RISE</span></div>
            <div className="header-info">
              <h2>HoD Dashboard</h2>
              <div className="dept-badge">{currentUser.department} • {currentUser.college} College</div>
            </div>
          </div>
          <div className="header-right">
            <div className="user-info">
              <span className="user-icon">👤</span>
              <span>{currentUser.name}</span>
            </div>
            <button className="logout-btn btn-danger"
              onClick={() => { setDeleteAccountPassword(''); setDeleteAccountError(''); setShowDeleteAccountModal(true); }}>
              🗑️ Delete Account
            </button>
            <button className="logout-btn" onClick={() => { logoutUser(); navigate('/', { replace: true }); }}>
              Logout ↩
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="dashboard-grid">

            {/* ══════════════════════════════════
                LEFT PANEL — Configure Session
            ══════════════════════════════════ */}
            <section className="panel config-panel">

              <div className="panel-header">
                <h3>👥 Faculty Pool</h3>
              </div>
              <p className="pool-hint">Add faculty here, then assign them to years, sections and subjects.</p>

              {/* Single input — Req 1 */}
              <div className="faculty-add-form">
                <input
                  type="text"
                  placeholder="Enter Faculty Full Name"
                  value={newFacultyName}
                  onChange={e => setNewFacultyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addOrUpdateFaculty()}
                  className="faculty-name-input"
                />
                <button
                  type="button"
                  className={`btn-add ${editingId ? 'btn-update' : ''}`}
                  onClick={addOrUpdateFaculty}
                  disabled={isSaving}
                >
                  {isSaving ? '…' : editingId ? 'Update' : '+ Add'}
                </button>
                {editingId && (
                  <button type="button" className="btn-cancel-edit"
                    onClick={() => { setEditingId(null); setNewFacultyName(''); }}>
                    ✕
                  </button>
                )}
              </div>

              <div className="divider" />

              <button type="button" className="btn-manage-sections"
                onClick={() => { setSectionError(''); setShowSectionModal(true); }}>
                🗂️ Manage Class Sections
              </button>

              <button type="button" className="btn-publish" onClick={openPublishModal}>
                🚀 Publish Feedback Link
              </button>

              <div className="divider" />

              {/* Download — Req 4 & 9 */}
              <div className="download-section">
                <h4 className="download-title">📥 Download Section Responses</h4>
                <select
                  value={downloadYear}
                  onChange={e => { setDownloadYear(e.target.value); setDownloadSection(''); }}
                  className="download-select"
                >
                  <option value="">Select Year</option>
                  {availableYears.map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
                <select
                  value={downloadSection}
                  onChange={e => setDownloadSection(e.target.value)}
                  disabled={!downloadYear}
                  className="download-select"
                >
                  <option value="">
                    {!downloadYear
                      ? 'Select year first'
                      : downloadSections.length === 0
                        ? 'No completed sections yet'
                        : 'Select Section'}
                  </option>
                  {downloadSections.map(s => (
                    <option key={s.id} value={s.sectionName}>Section {s.sectionName} ✅</option>
                  ))}
                </select>
                <button type="button" className="btn-download"
                  onClick={() => {
                    if (!downloadYear || !downloadSection) {
                      showToast('Select both Year and Section to download.');
                      return;
                    }
                    showToast('Download format will be configured soon.', 'info');
                  }}>
                  📥 Download
                </button>
              </div>
            </section>

            {/* ══════════════════════════════════
                RIGHT PANEL — Faculty List
            ══════════════════════════════════ */}
            <section className="panel list-panel">

              {/* Pool chips */}
              <div className="pool-panel-header">
                <h3>👥 Faculty Pool <span className="count-badge">{globalFacultyPool.length}</span></h3>
                <button type="button" className="btn-assign-new" onClick={openAssignModal}>
                  + Assign Faculty
                </button>
              </div>

              <div className="pool-chips">
                {globalFacultyPool.length === 0 && (
                  <p className="pool-empty">No faculty added yet. Use the left panel to add.</p>
                )}
                {globalFacultyPool.map(f => (
                  <div key={f.id} className="pool-chip">
                    <span className="chip-name">{f.name}</span>
                    <button type="button" className="chip-btn chip-edit"
                      onClick={() => { setNewFacultyName(f.name); setEditingId(f.id); }}
                      title="Edit">✏️</button>
                    <button type="button" className="chip-btn chip-delete"
                      onClick={() => deleteFaculty(f.id)}
                      title="Delete">🗑</button>
                  </div>
                ))}
              </div>

              <div className="divider" style={{ margin: '10px 0' }} />

              {/* Assigned faculty header */}
              <div className="panel-header" style={{ marginBottom: '12px' }}>
                <h3>📋 Assignments <span className="count-badge">{assignedFaculty.length}</span></h3>
              </div>

              {/* ── S&H Layout ── */}
              {isSH ? (
                <div className="sh-layout">
                  <div className="branch-sidebar">
                    <div className="sidebar-header">Branches</div>
                    {availableBranches.map(branch => (
                      <button key={branch} type="button"
                        className={`branch-btn ${selectedBranch === branch ? 'active' : ''}`}
                        onClick={() => setSelectedBranch(branch)}>
                        <span className="branch-name">{branch}</span>
                        <span className="branch-count">{assignedFaculty.filter(f => f.branch === branch).length}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '8px' }}>
                    {selectedBranch && (
                      <div className="section-filter-tabs">
                        <button type="button"
                          className={`sec-tab ${!selectedSHSection ? 'active' : ''}`}
                          onClick={() => setSelectedSHSection(null)}>All</button>
                        {(sectionsByKey[selectedBranch] || []).map(s => (
                          <button key={s.id} type="button"
                            className={`sec-tab ${selectedSHSection === s.sectionName ? 'active' : ''}`}
                            onClick={() => setSelectedSHSection(s.sectionName)}>
                            {s.sectionName} ({s.strength || 0})
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="faculty-list">
                      {!selectedBranch && <div className="empty-state"><span className="empty-icon">📚</span><p>Select a branch</p></div>}
                      {selectedBranch && filteredFaculty.length === 0 && <div className="empty-state"><span className="empty-icon">🧑‍🏫</span><p>No assignments for {selectedBranch}</p></div>}
                      {filteredFaculty.map(f => (
                        <FacultyCard key={f.id} f={f} onDelete={deleteFaculty} onPDF={handleDownloadPDF} onExcel={handleDownloadExcel} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Normal (non S&H) Layout ── */
                <>
                  <div className="year-tabs">
                    {availableYears.map(y => (
                      <button key={y} type="button"
                        className={`tab-btn ${selectedYear === y ? 'active' : ''}`}
                        onClick={() => { setSelectedYear(y); setSelectedSection(null); setEditingSection(null); }}>
                        <span>{y} Year</span>
                        <span className="count">{assignedFaculty.filter(f => f.year === y).length}</span>
                      </button>
                    ))}
                  </div>

                  <div className="sh-layout" style={{ flex: 1, minHeight: 0 }}>
                    {/* Section sidebar — Req 3 */}
                    <div className="branch-sidebar">
                      <div className="sidebar-header">Sections</div>
                      {!selectedYear && <p className="sidebar-hint">Pick a year</p>}
                      {selectedYear && (
                        <>
                          <button type="button"
                            className={`branch-btn ${selectedSection === null ? 'active' : ''}`}
                            onClick={() => { setSelectedSection(null); setEditingSection(null); }}>
                            <span className="branch-name">All</span>
                            <span className="branch-count">{assignedFaculty.filter(f => f.year === selectedYear).length}</span>
                          </button>

                          {(sectionsByKey[selectedYear] || []).map(s => (
                            <div key={s.id} className="section-sidebar-item">
                              {editingSection === s.id ? (
                                /* Inline edit mode */
                                <div className="sec-edit-form">
                                  <input
                                    value={editSectionName}
                                    onChange={e => setEditSectionName(e.target.value)}
                                    className="sec-edit-name"
                                    placeholder="Name"
                                  />
                                  <input
                                    type="number"
                                    value={editSectionStrength}
                                    onChange={e => setEditSectionStrength(e.target.value)}
                                    className="sec-edit-str"
                                    placeholder="Strength"
                                  />
                                  <button type="button" className="qa-btn qa-save"
                                    onClick={() => saveEditSection(s.id)}>✓</button>
                                  <button type="button" className="qa-btn qa-cancel"
                                    onClick={() => setEditingSection(null)}>✕</button>
                                </div>
                              ) : (
                                /* Normal display */
                                <div className="sec-display-row">
                                  <button type="button"
                                    className={`branch-btn sec-branch-btn ${selectedSection === s.sectionName ? 'active' : ''}`}
                                    onClick={() => setSelectedSection(s.sectionName)}>
                                    <span className="branch-name">{s.sectionName}</span>
                                    <span className="branch-count">{s.strength || 0}👤</span>
                                  </button>
                                  <div className="sec-actions">
                                    <button type="button" className="qa-btn qa-edit"
                                      title="Edit section"
                                      onClick={() => startEditSection(s)}>✏️</button>
                                    <button type="button" className="qa-btn qa-delete"
                                      title="Delete section"
                                      onClick={async () => {
                                        if (!window.confirm(`Delete section "${s.sectionName}"?`)) return;
                                        try {
                                          await sectionAPI.delete(s.id);
                                          setSections(prev => prev.filter(x => x.id !== s.id));
                                          if (selectedSection === s.sectionName) setSelectedSection(null);
                                        } catch (err) {
                                          showToast('Failed to delete section.');
                                        }
                                      }}>🗑</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {(sectionsByKey[selectedYear] || []).length === 0 && (
                            <p className="sidebar-hint">No sections.<br />Use Manage Sections.</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="faculty-list">
                      {!selectedYear && <div className="empty-state"><span className="empty-icon">📂</span><p>Select a year</p></div>}
                      {selectedYear && filteredFaculty.length === 0 && (
                        <div className="empty-state">
                          <span className="empty-icon">🧑‍🏫</span>
                          <p>{selectedSection ? `No assignments in Section ${selectedSection}` : `No assignments for Year ${selectedYear}`}</p>
                          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Use "+ Assign Faculty" above</p>
                        </div>
                      )}
                      {filteredFaculty.map(f => (
                        <FacultyCard key={f.id} f={f} onDelete={deleteFaculty} onPDF={handleDownloadPDF} onExcel={handleDownloadExcel} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ══════════════════════════════════════════
              LIVE FEED — Req 8
          ══════════════════════════════════════════ */}
          <section className="live-feed-section">
            <div className="live-feed-header">
              <h3>📡 Published Feedback Links</h3>
              <span className="live-pill">● LIVE</span>
            </div>
            {allBatches.length === 0 ? (
              <div className="live-feed-empty">
                No published links yet. Hit "🚀 Publish Feedback Link" to get started.
              </div>
            ) : (
              <div className="live-feed-grid">
                {allBatches.map(batch => {
                  const responses = batch.responseCount || 0;
                  const total = batch.totalStudents || 0;
                  const pct = total > 0 ? Math.min(100, Math.round((responses / total) * 100)) : 0;
                  const now = new Date();
                  const isLive = batch.slotStartDate && batch.slotEndDate
                    && now >= new Date(batch.slotStartDate) && now <= new Date(batch.slotEndDate);
                  return (
                    <div key={batch.id} className={`lfc ${isLive ? 'lfc--live' : 'lfc--ended'}`}>
                      <div className="lfc-top">
                        <span className={`lfc-status ${isLive ? 'live' : 'ended'}`}>
                          {isLive ? '🟢 LIVE' : '⚫ ENDED'}
                        </span>
                        <span className="lfc-slot">Slot {batch.slot}</span>
                      </div>
                      <div className="lfc-identity">
                        <span>Year {batch.year}</span>
                        <span className="lfc-dot">•</span>
                        <span>Sem {batch.sem}</span>
                        <span className="lfc-dot">•</span>
                        <span>Sec {batch.sec}</span>
                      </div>
                      <div className="lfc-dates">
                        📅 {batch.slotStartDate ? new Date(batch.slotStartDate).toLocaleDateString('en-IN') : '—'}
                        {' → '}
                        {batch.slotEndDate ? new Date(batch.slotEndDate).toLocaleDateString('en-IN') : '—'}
                      </div>
                      <div className="lfc-progress-row">
                        <span className="lfc-resp-count">{responses}/{total}</span>
                        <div className="lfc-bar">
                          <div className="lfc-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="lfc-pct">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* ══════════════════════════════════════════
            PUBLISH MODAL — Req 7
        ══════════════════════════════════════════ */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content publish-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔗 Publish Feedback Link</h2>
                <p>{publishStep === 1 ? 'Step 1 — Configure slot & section' : 'Step 2 — Review faculty & confirm'}</p>
              </div>

              {publishStep === 1 && (
                <div className="modal-body">
                  <div className="form-field">
                    <label>Semester</label>
                    <select value={publishSem} onChange={e => setPublishSem(e.target.value)}>
                      <option value="">Select Semester</option>
                      {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                    </select>
                  </div>

                  {!isSH && (
                    <div className="form-field">
                      <label>Year</label>
                      <select value={publishYear} onChange={e => { setPublishYear(e.target.value); setPublishSection(''); }}>
                        <option value="">Select Year</option>
                        {availableYears.map(y => <option key={y} value={y}>{y} Year</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-field">
                    <label>Section</label>
                    <select value={publishSection}
                      onChange={e => {
                        setPublishSection(e.target.value);
                        const key = isSH ? selectedBranch : publishYear;
                        const sec = (sectionsByKey[key] || []).find(s => s.sectionName === e.target.value);
                        if (sec?.strength) setPublishStudents(String(sec.strength));
                      }}>
                      <option value="">Select Section</option>
                      {(sectionsByKey[isSH ? selectedBranch : publishYear] || []).map(s => (
                        <option key={s.id} value={s.sectionName}>{s.sectionName} ({s.strength || 0} students)</option>
                      ))}
                    </select>
                  </div>

                  {/* Slot selection — same logic as before */}
                  <div className="form-field">
                    <label>Select Slot</label>
                    {(() => {
                      const ty = isSH ? 'I' : publishYear;
                      const s1done = allBatches.some(b => b.year === ty && b.sem === publishSem && b.sec === publishSection && b.slot === 1);
                      const s2done = allBatches.some(b => b.year === ty && b.sem === publishSem && b.sec === publishSection && b.slot === 2);
                      return (
                        <div className="slot-btn-row">
                          <button type="button" disabled={s1done}
                            className={`slot-btn ${slotNumber === 1 && !s1done ? 'active' : ''} ${s1done ? 'done' : ''}`}
                            onClick={() => !s1done && setSlotNumber(1)}>
                            {s1done ? '✅ Slot 1 Done' : '📋 Slot 1 — Previous'}
                          </button>
                          <button type="button" disabled={!s1done || s2done}
                            className={`slot-btn ${slotNumber === 2 ? 'active' : ''} ${s2done ? 'done' : ''}`}
                            onClick={() => s1done && !s2done && setSlotNumber(2)}>
                            {s2done ? '✅ Slot 2 Done' : !s1done ? '🔒 Slot 2 (Locked)' : '📋 Slot 2 — Latest'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="date-row">
                    <div className="form-field">
                      <label>Start Date</label>
                      <input type="date" value={slotStartDate} onChange={e => setSlotStartDate(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label>End Date</label>
                      <input type="date" value={slotEndDate} min={slotStartDate} onChange={e => setSlotEndDate(e.target.value)} />
                    </div>
                  </div>

                  {slotStartDate && slotEndDate && (
                    <div className="date-preview">
                      ℹ️ Active: {new Date(slotStartDate).toLocaleDateString('en-IN')} → {new Date(slotEndDate).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
              )}

              {publishStep === 2 && (
                <div className="modal-body">
                  <div className="publish-review-meta">
                    <span>📅 Year <strong>{publishYear}</strong> · Sem <strong>{publishSem}</strong> · Sec <strong>{publishSection}</strong></span>
                    <span>📌 Slot {slotNumber} · {slotStartDate} → {slotEndDate}</span>
                  </div>
                  <p className="publish-review-hint">Uncheck any faculty you want to exclude from this link.</p>
                  {publishSectionFaculty.length === 0 ? (
                    <div className="publish-no-faculty">⚠️ No faculty assigned to this section for Semester {publishSem}.</div>
                  ) : (
                    <table className="publish-faculty-table">
                      <thead>
                        <tr><th>#</th><th>Faculty Name</th><th>Subject</th><th>Include</th></tr>
                      </thead>
                      <tbody>
                        {publishSectionFaculty.map((f, i) => (
                          <tr key={f.id} className={selectedFacultyIds.includes(f.id) ? 'row-selected' : ''}>
                            <td>{i + 1}</td>
                            <td>{f.name}</td>
                            <td>{f.subject || '—'}</td>
                            <td>
                              <input type="checkbox"
                                checked={selectedFacultyIds.includes(f.id)}
                                onChange={() => setSelectedFacultyIds(prev =>
                                  prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                                )}
                                style={{ accentColor: '#0ea5e9', width: 16, height: 16 }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <div className="modal-footer">
                {publishStep === 1 ? (
                  <>
                    <button className="btn-confirm" onClick={handlePublishProceed}>Proceed →</button>
                    <button className="btn-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn-confirm" onClick={confirmPublish} disabled={isPublishing}>
                      {isPublishing ? '⏳ Publishing…' : '✅ Confirm & Publish'}
                    </button>
                    <button className="btn-modal-cancel" onClick={() => setPublishStep(1)}>← Back</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ASSIGN FACULTY MODAL (Multi-step) — Req 6
        ══════════════════════════════════════════ */}
        {showAssignModal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal-content assign-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📌 Assign Faculty</h2>
                <div className="step-indicator">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`step-dot ${assignStep === n ? 'active' : assignStep > n ? 'done' : ''}`}>
                      {assignStep > n ? '✓' : n}
                    </div>
                  ))}
                </div>
                <p>
                  {assignStep === 1 && 'Select Year & Semester'}
                  {assignStep === 2 && 'Enter subjects taught this semester'}
                  {assignStep === 3 && 'Assign faculty for each subject & section'}
                </p>
              </div>

              <div className="modal-body">
                {/* Step 1 */}
                {assignStep === 1 && (
                  <div className="assign-step">
                    {!isSH && (
                      <div className="form-field">
                        <label>Year</label>
                        <select value={assignYear} onChange={e => { setAssignYear(e.target.value); setAssignRows([]); }}>
                          <option value="">Select Year</option>
                          {availableYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-field">
                      <label>Semester</label>
                      <select value={assignSem} onChange={e => setAssignSem(e.target.value)}>
                        <option value="">Select Semester</option>
                        {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {assignStep === 2 && (
                  <div className="assign-step">
                    <div className="step-context-badge">
                      {!isSH && `Year ${assignYear} · `}Semester {assignSem}
                    </div>
                    <div className="form-field">
                      <label>How many subjects this semester?</label>
                      <input type="number" min="1" max="10"
                        value={assignSubjectCount}
                        onChange={e => {
                          const n = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                          setAssignSubjectCount(n);
                          setAssignSubjectNames(prev => {
                            const a = [...prev];
                            while (a.length < n) a.push('');
                            return a.slice(0, n);
                          });
                        }}
                        className="subject-count-input"
                      />
                    </div>
                    <div className="subject-inputs-list">
                      {Array.from({ length: assignSubjectCount }, (_, i) => (
                        <div className="form-field" key={i}>
                          <label>Subject {i + 1}</label>
                          <input type="text"
                            placeholder={`e.g. ${['Data Structures', 'Computer Networks', 'DBMS', 'OS', 'Algorithms'][i] || 'Subject Name'}`}
                            value={assignSubjectNames[i] || ''}
                            onChange={e => {
                              const a = [...assignSubjectNames];
                              a[i] = e.target.value;
                              setAssignSubjectNames(a);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {assignStep === 3 && (
                  <div className="assign-step">
                    <div className="step-context-badge">
                      {!isSH && `Year ${assignYear} · `}Semester {assignSem} — {assignRows.length} subject{assignRows.length !== 1 ? 's' : ''}
                    </div>
                    <div className="assign-rows-list">
                      {assignRows.map((row, i) => (
                        <div key={i} className="assign-row-card">
                          <div className="arc-subject">{row.subjectName}</div>
                          <div className="arc-selects">
                            <div>
                              <label>Section</label>
                              <select value={row.section}
                                onChange={e => {
                                  const a = [...assignRows];
                                  a[i] = { ...a[i], section: e.target.value };
                                  setAssignRows(a);
                                }}>
                                <option value="">— Section —</option>
                                {(sectionsByKey[isSH ? selectedBranch : assignYear] || []).map(s => (
                                  <option key={s.id} value={s.sectionName}>{s.sectionName}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label>Faculty</label>
                              <select value={row.facultyId}
                                onChange={e => {
                                  const a = [...assignRows];
                                  a[i] = { ...a[i], facultyId: e.target.value };
                                  setAssignRows(a);
                                }}>
                                <option value="">— Faculty —</option>
                                {globalFacultyPool.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {assignStep === 1 && (
                  <>
                    <button className="btn-confirm" onClick={handleAssignStep1}>Next →</button>
                    <button className="btn-modal-cancel" onClick={() => setShowAssignModal(false)}>Cancel</button>
                  </>
                )}
                {assignStep === 2 && (
                  <>
                    <button className="btn-confirm" onClick={handleAssignStep2}>Next →</button>
                    <button className="btn-modal-cancel" onClick={() => setAssignStep(1)}>← Back</button>
                  </>
                )}
                {assignStep === 3 && (
                  <>
                    <button className="btn-confirm" onClick={handleAssignFaculty} disabled={isAssigning}>
                      {isAssigning ? '⏳ Assigning…' : '✅ Assign All'}
                    </button>
                    <button className="btn-modal-cancel" onClick={() => setAssignStep(2)}>← Back</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            MANAGE SECTIONS MODAL — Req 2
        ══════════════════════════════════════════ */}
        {showSectionModal && (
          <div className="modal-overlay" onClick={() => setShowSectionModal(false)}>
            <div className="modal-content sections-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗂️ Manage Class Sections</h2>
                <p>
                  {isSH
                    ? 'Set up sections per department for 1st year.'
                    : `Configure sections for each year. ${TWO_YEAR_DEPTS.includes(currentUser?.department) ? 'Years I & II only.' : 'Years II, III & IV.'}`}
                </p>
              </div>

              <div className="modal-body sections-modal-body">
                {(isSH ? availableBranches : availableYears).map(key => (
                  <div key={key} className="syb-block">
                    <div className="syb-header">
                      <span>{isSH ? `📖 ${key}` : `📅 Year ${key}`}</span>
                      <span className="syb-count">
                        {(sectionsByKey[key] || []).length} section{(sectionsByKey[key] || []).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="syb-body">
                      {/* Existing section chips */}
                      <div className="existing-chips">
                        {(sectionsByKey[key] || []).length === 0 && (
                          <span className="no-secs">No sections yet.</span>
                        )}
                        {(sectionsByKey[key] || []).map(s => (
                          <div key={s.id} className="esc-chip">
                            <span className="esc-name">{s.sectionName}</span>
                            {editingStrengthId === s.id ? (
                              <>
                                <input type="number" value={editingStrengthVal}
                                  onChange={e => setEditingStrengthVal(e.target.value)}
                                  className="esc-str-input" autoFocus />
                                <button type="button" className="esc-btn esc-save"
                                  onClick={async () => {
                                    await sectionAPI.update(s.id, { strength: Number(editingStrengthVal) });
                                    setSections(prev => prev.map(x => x.id === s.id ? { ...x, strength: Number(editingStrengthVal) } : x));
                                    setEditingStrengthId(null);
                                  }}>✓</button>
                                <button type="button" className="esc-btn esc-cancel"
                                  onClick={() => setEditingStrengthId(null)}>✕</button>
                              </>
                            ) : (
                              <span className="esc-strength" title="Click to edit"
                                onClick={() => { setEditingStrengthId(s.id); setEditingStrengthVal(String(s.strength || 0)); }}>
                                {s.strength || 0}👤
                              </span>
                            )}
                            <button type="button" className="esc-btn esc-delete"
                              onClick={async () => {
                                if (!window.confirm(`Delete section "${s.sectionName}"?`)) return;
                                await sectionAPI.delete(s.id);
                                setSections(prev => prev.filter(x => x.id !== s.id));
                              }}>🗑</button>
                          </div>
                        ))}
                      </div>

                      {/* Add new section row */}
                      <div className="add-sec-row">
                        <input type="text" placeholder="Name (e.g. A, B, CSE-A)"
                          value={sectionForm.key === key ? sectionForm.sectionName : ''}
                          onChange={e => setSectionForm({ key, sectionName: e.target.value, strength: sectionForm.key === key ? sectionForm.strength : '', applyAll: sectionForm.key === key ? sectionForm.applyAll : false })}
                          className="add-sec-name"
                        />
                        <input type="number" placeholder="Strength"
                          value={sectionForm.key === key ? sectionForm.strength : ''}
                          onChange={e => setSectionForm(f => ({ ...f, key, strength: e.target.value }))}
                          className="add-sec-strength"
                        />
                        {!isSH && (
                          <label className="apply-all-lbl">
                            <input type="checkbox"
                              checked={!!(sectionForm.key === key && sectionForm.applyAll)}
                              onChange={e => setSectionForm(f => ({ ...f, key, applyAll: e.target.checked }))} />
                            All years
                          </label>
                        )}
                        <button type="button" className="btn-add-sec"
                          onClick={async () => {
                            setSectionError('');
                            const name = (sectionForm.key === key ? sectionForm.sectionName : '').trim();
                            const strength = Number(sectionForm.key === key ? sectionForm.strength : 0) || 0;
                            const applyAll = sectionForm.key === key ? !!sectionForm.applyAll : false;
                            if (!name) { setSectionError('Section name is required.'); return; }
                            try {
                              if (!isSH && applyAll) {
                                const newSecs = [];
                                for (const yr of availableYears) {
                                  const res = await sectionAPI.create({ year: yr, branch: '', sectionName: name, strength });
                                  newSecs.push(res.data.section);
                                }
                                setSections(prev => [...prev, ...newSecs]);
                              } else {
                                const res = await sectionAPI.create({ year: isSH ? 'I' : key, branch: isSH ? key : '', sectionName: name, strength });
                                setSections(prev => [...prev, res.data.section]);
                              }
                              setSectionForm({ key: null, sectionName: '', strength: '', applyAll: false });
                            } catch (err) {
                              setSectionError(err.response?.data?.error || 'Failed to add section.');
                            }
                          }}>
                          + Add
                        </button>
                      </div>
                      {sectionError && sectionForm.key === key && (
                        <p className="sec-err">{sectionError}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-confirm" onClick={() => setShowSectionModal(false)}>✅ Done</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Account Modal ── */}
        {showDeleteAccountModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>🗑️ Delete Account</h3></div>
              <div style={{ padding: '20px' }}>
                <div className="delete-warn-box">
                  ⚠️ This will permanently delete the HoD account for <strong>{currentUser.department} — {currentUser.college}</strong>. This action cannot be undone.
                </div>
                <div className="form-field" style={{ margin: '14px 0' }}>
                  <label>Enter your password to confirm:</label>
                  <input type="password" value={deleteAccountPassword}
                    onChange={e => { setDeleteAccountPassword(e.target.value); setDeleteAccountError(''); }}
                    placeholder="Current password" autoComplete="current-password" />
                </div>
                {deleteAccountError && <div className="delete-error">⚠️ {deleteAccountError}</div>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleDeleteAccount} disabled={isDeletingAccount}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: '700', background: isDeletingAccount ? '#ccc' : '#e74c3c', color: '#fff', cursor: isDeletingAccount ? 'not-allowed' : 'pointer' }}>
                    {isDeletingAccount ? 'Deleting…' : '🗑️ Yes, Delete'}
                  </button>
                  <button onClick={() => setShowDeleteAccountModal(false)} disabled={isDeletingAccount}
                    className="btn-modal-cancel">Cancel</button>
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

/* ─────────────────────────────────────────────
   Faculty Card (extracted for cleanliness)
───────────────────────────────────────────── */
function FacultyCard({ f, onDelete, onPDF, onExcel }) {
  return (
    <div className="faculty-card">
      <div className="faculty-info">
        <div className="faculty-code">{f.code}</div>
        <div className="faculty-details">
          <div className="faculty-name">{f.name}</div>
          <div className="faculty-subject">{f.subject}</div>
          <div className="faculty-badge">Year {f.year} • Sem {f.semester || f.sem} • Sec {f.section || f.sec}</div>
        </div>
      </div>
      <div className="faculty-actions">
        <button type="button" className="btn-icon delete" onClick={() => onDelete(f.id)} title="Remove">🗑️</button>
        <button type="button" className="btn-icon" onClick={() => onPDF(f)} title="PDF" style={{ background: 'rgba(239,68,68,0.1)' }}>📄</button>
        <button type="button" className="btn-icon" onClick={() => onExcel(f)} title="Excel" style={{ background: 'rgba(16,185,129,0.1)' }}>📊</button>
      </div>
    </div>
  );
}

export default HoDDashboard;
