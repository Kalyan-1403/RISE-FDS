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

/* ─── normalize a single faculty record ─── */
function normalizeFaculty(f) {
  return {
    ...f,
    year:    String(f.year    || '').trim(),
    sem:     String(f.sem     || f.semester || '').trim(),
    sec:     String(f.sec     || f.section  || '').trim(),
    branch:  String(f.branch  || f.dept     || '').trim(),
    subject: String(f.subject || '').trim(),
    name:    String(f.name    || '').trim(),
    code:    String(f.code    || '').trim(),
  };
}

/* ─── Toast ─── */
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

  const [facultyList,  setFacultyList]  = useState([]);
  const [allBatches,   setAllBatches]   = useState([]);

  const [newFacultyName, setNewFacultyName] = useState('');
  const [editingId,      setEditingId]      = useState(null);
  const [isSaving,       setIsSaving]       = useState(false);

  const [selectedYear,      setSelectedYear]      = useState('');
  const [selectedBranch,    setSelectedBranch]    = useState('');
  const [selectedSection,   setSelectedSection]   = useState(null);
  const [selectedSHSection, setSelectedSHSection] = useState(null);

  const [sections, setSections] = useState([]);

  const [editingSection,      setEditingSection]      = useState(null);
  const [editSectionName,     setEditSectionName]     = useState('');
  const [editSectionStrength, setEditSectionStrength] = useState('');

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionForm,      setSectionForm]      = useState({ key: null, sectionName: '', strength: '', applyAll: false });
  const [sectionError,     setSectionError]     = useState('');
  const [editStrengthId,   setEditStrengthId]   = useState(null);
  const [editStrengthVal,  setEditStrengthVal]  = useState('');

  const [showAssignModal,    setShowAssignModal]    = useState(false);
  const [assignStep,         setAssignStep]         = useState(1);
  const [assignYear,         setAssignYear]         = useState('');
  const [assignSem,          setAssignSem]          = useState('');
  const [assignSubjectCount, setAssignSubjectCount] = useState(1);
  const [assignSubjectNames, setAssignSubjectNames] = useState(['']);
  const [assignRows,         setAssignRows]         = useState([]);
  const [isAssigning,        setIsAssigning]        = useState(false);

  const [showModal,      setShowModal]      = useState(false);
  const [publishStep,    setPublishStep]    = useState(1);
  const [publishYear,    setPublishYear]    = useState('');
  const [publishSem,     setPublishSem]     = useState('');
  const [publishSection, setPublishSection] = useState('');
  const [publishStudents,setPublishStudents]= useState('');
  const [slotNumber,     setSlotNumber]     = useState(1);
  const [slotStartDate,  setSlotStartDate]  = useState('');
  const [slotEndDate,    setSlotEndDate]    = useState('');
  const [selFacIds,      setSelFacIds]      = useState([]);
  const [isPublishing,   setIsPublishing]   = useState(false);

  const [downloadYear,    setDownloadYear]    = useState('');
  const [downloadSection, setDownloadSection] = useState('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePwd,       setDeletePwd]       = useState('');
  const [deleteErr,       setDeleteErr]       = useState('');
  const [isDeleting,      setIsDeleting]      = useState(false);

  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const showToast = useCallback((message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4500);
  }, []);

/* ── Data loading ── */
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const dashData = await dataService.getHoDDashboard();
      // FIX: Check if it exists, and map through normalizeFaculty!
      if (dashData.faculty !== undefined) setFacultyList(dashData.faculty.map(normalizeFaculty));
      if (dashData.batches !== undefined) setAllBatches(dashData.batches);
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
    const interval = setInterval(loadDashboardData, 30000);
    const onFocus = () => loadDashboardData();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [currentUser, navigate, loadDashboardData, loadSections]);

  /* ── Memos ── */
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

  const availableBranches = useMemo(() =>
    isSH ? (BRANCHES_BY_COLLEGE[currentUser?.college] || []) : [],
    [currentUser, isSH]
  );

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
      if (selectedSHSection) list = list.filter(f => f.sec === selectedSHSection);
      return list;
    }
    if (!selectedYear) return [];
    let list = assignedFaculty.filter(f => f.year === selectedYear);
    if (selectedSection) list = list.filter(f => f.sec === selectedSection);
    return list;
  }, [assignedFaculty, selectedYear, selectedBranch, selectedSection, selectedSHSection, isSH]);

  const publishSectionFaculty = useMemo(() => {
    return assignedFaculty.filter(f => {
      const matchBranch = isSH ? f.branch === selectedBranch : f.year === publishYear;
      return matchBranch && f.sem === publishSem && f.sec === publishSection;
    });
  }, [assignedFaculty, isSH, selectedBranch, publishYear, publishSem, publishSection]);

  const downloadSections = useMemo(() => {
    if (!downloadYear) return [];
    return (sectionsByKey[downloadYear] || []).filter(s => {
      const batch = allBatches.find(b => b.year === downloadYear && (b.sec === s.sectionName || b.section === s.sectionName));
      return batch && batch.totalStudents > 0 && (batch.responseCount || 0) >= batch.totalStudents;
    });
  }, [downloadYear, sectionsByKey, allBatches]);

const assignedCountBySec = useMemo(() => {
    const map = {};
    assignedFaculty.forEach(f => {
      const k = isSH ? `${f.branch}__${f.year}__${f.sec}` : `${f.year}__${f.sec}`;
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [assignedFaculty, isSH]);

  /* ── Pool handlers ── */
  const addOrUpdateFaculty = async () => {
    const trimmed = newFacultyName.trim();
    if (!trimmed) { showToast('Please enter the faculty full name.'); return; }
    if (!/^[A-Za-z\s.]+$/.test(trimmed)) { showToast('Name must contain only letters, spaces and dots.'); return; }
    const autoCode = trimmed.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 5);
    const payload = {
      name: trimmed, subject: 'TBD', code: autoCode, year: '',
      branch: isSH ? (selectedBranch || '') : currentUser.department,
      sem: '', sec: '', dept: currentUser.department, college: currentUser.college,
    };
    setIsSaving(true);
    try {
      if (editingId) {
        await dataService.updateFaculty(editingId, payload);
        setEditingId(null);
        showToast('Faculty updated.', 'success');
      } else {
        await dataService.createFaculty(payload);
        showToast(`${trimmed} added to pool.`, 'success');
      }
      await loadDashboardData();
      setNewFacultyName('');
    } catch (err) { showToast(err.message || 'Failed to save faculty.'); }
    finally { setIsSaving(false); }
  };

  const deleteFaculty = async (id) => {
    if (!window.confirm('Remove this faculty entry? This cannot be undone.')) return;
    try { await dataService.deleteFacultyById(id); await loadDashboardData(); }
    catch (err) { showToast(err.message || 'Delete failed.'); }
  };

  /* ── Assign handlers ── */
  const openAssignModal = () => {
    if (!globalFacultyPool.length) { showToast('Add faculty to the pool first.'); return; }
    setAssignStep(1); setAssignYear(''); setAssignSem('');
    setAssignSubjectCount(1); setAssignSubjectNames(['']); setAssignRows([]);
    setShowAssignModal(true);
  };

  const handleAssignStep1 = () => {
    if (!isSH && !assignYear) { showToast('Select a Year.'); return; }
    if (!assignSem) { showToast('Select a Semester.'); return; }
    setAssignStep(2);
  };

  const handleAssignStep2 = () => {
    const subjectRegex = /^[A-Za-z\s&\-().,0-9]+$/;
    const valid = assignSubjectNames.map(s => s.trim()).filter(Boolean);
    if (!valid.length) { showToast('Enter at least one subject name.'); return; }
    for (const s of valid) {
      if (!subjectRegex.test(s)) { showToast(`"${s}" contains invalid characters.`); return; }
    }
    setAssignRows(valid.map(s => ({ subjectName: s, section: '', facultyId: '' })));
    setAssignStep(3);
  };

  const handleAssignFaculty = async () => {
    for (const row of assignRows) {
      if (!row.section)   { showToast('Select a section for every row.');  return; }
      if (!row.facultyId) { showToast('Select a faculty for every row.'); return; }
    }
    setIsAssigning(true);
    try {
      for (const row of assignRows) {
        // FIX: Convert both IDs to strings so the dropdown value matches the database number
        const faculty = globalFacultyPool.find(f => String(f.id) === String(row.facultyId));
        if (!faculty) continue;
        await dataService.createFaculty({
          name: faculty.name, subject: row.subjectName, code: faculty.code,
          year: isSH ? 'I' : assignYear,
          branch: isSH ? selectedBranch : currentUser.department,
          sem: assignSem, sec: row.section,
          dept: currentUser.department, college: currentUser.college,
        });
      }
      await loadDashboardData();
      showToast(`${assignRows.length} assignment(s) saved.`, 'success');
      setShowAssignModal(false);
    } catch (err) { showToast(err.message || 'Assignment failed.'); }
    finally { setIsAssigning(false); }
  };

  /* ── Publish handlers ── */
  const openPublishModal = () => {
    if (!assignedFaculty.length) { showToast('Assign faculty to sections before publishing.'); return; }
    setPublishStep(1); setPublishYear(isSH ? 'I' : ''); setPublishSem('');
    setPublishSection(''); setPublishStudents('');
    setSlotNumber(1); setSlotStartDate(''); setSlotEndDate(''); setSelFacIds([]);
    setShowModal(true);
  };

  const handlePublishProceed = () => {
    if (!publishSem) { showToast('Select a Semester.'); return; }
    if (!isSH && !publishYear) { showToast('Select a Year.'); return; }
    if (!publishSection) { showToast('Select a Section.'); return; }
    if (!slotStartDate || !slotEndDate) { showToast('Select start and end dates.'); return; }
    if (new Date(slotEndDate) <= new Date(slotStartDate)) { showToast('End date must be after start date.'); return; }
    if (!publishSectionFaculty.length) {
      showToast(`No faculty found for Year ${publishYear} · Sem ${publishSem} · Sec ${publishSection}. Assign faculty first.`); return;
    }
    setSelFacIds(publishSectionFaculty.map(f => f.id));
    setPublishStep(2);
  };

  const confirmPublish = async () => {
    if (!selFacIds.length) { showToast('Include at least one faculty.'); return; }
    const targetYear   = isSH ? 'I' : publishYear;
    const targetBranch = isSH ? selectedBranch : currentUser.department;
    setIsPublishing(true);
    try {
      const result = await dataService.createBatch({
        college: currentUser.college, dept: currentUser.department,
        branch: targetBranch, year: targetYear, sem: publishSem,
        sec: publishSection, slot: slotNumber, slotStartDate, slotEndDate,
        slotLabel: slotNumber === 1 ? 'Previous Feedback Cycle' : 'Latest Feedback Cycle',
        faculty_ids: selFacIds, totalStudents: parseInt(publishStudents) || 0,
      });
      if (result?.feedbackLink) {
        const full = result.feedbackLink.startsWith('http')
          ? result.feedbackLink : `${window.location.origin}${result.feedbackLink}`;
        try { await navigator.clipboard.writeText(full); } catch (_) {}
        showToast('Link published and copied to clipboard!', 'success');
        setShowModal(false);
        await loadDashboardData();
      }
    } catch (err) { showToast(err.message || 'Publish failed.'); }
    finally { setIsPublishing(false); }
  };

  /* ── Section sidebar edit ── */
  const startEditSection = (s) => {
    setEditingSection(s.id);
    setEditSectionName(s.sectionName);
    setEditSectionStrength(String(s.strength || 0));
  };

  const saveEditSection = async (id) => {
    if (!editSectionName.trim()) { showToast('Section name cannot be empty.'); return; }
    try {
      await sectionAPI.update(id, { sectionName: editSectionName.trim(), strength: Number(editSectionStrength) || 0 });
      setSections(prev => prev.map(x =>
        x.id === id ? { ...x, sectionName: editSectionName.trim(), strength: Number(editSectionStrength) || 0 } : x
      ));
      if (selectedSection === sections.find(s => s.id === id)?.sectionName) setSelectedSection(editSectionName.trim());
      setEditingSection(null);
    } catch (err) { showToast('Failed to update section.'); }
  };

  const deleteSection = async (s) => {
    if (!window.confirm(`Delete section "${s.sectionName}"? Cannot be undone.`)) return;
    try {
      await sectionAPI.delete(s.id);
      setSections(prev => prev.filter(x => x.id !== s.id));
      if (selectedSection === s.sectionName) setSelectedSection(null);
    } catch (err) { showToast('Failed to delete section.'); }
  };

  /* ── Download / PDF / Excel ── */
  const handleDownloadPDF = async (f) => {
    try {
      const stats = await dataService.getFacultyStats(f.id);
      if (!stats || stats.totalResponses === 0) { showToast('No feedback data available for PDF.'); return; }
      showToast(`PDF downloaded: ${generateFacultyPDF(f, stats, currentUser.college)}`, 'success');
    } catch (err) { showToast(`PDF failed: ${err?.message || 'Unknown error'}`); }
  };

  const handleDownloadExcel = async (f) => {
    try {
      const stats = await dataService.getFacultyStats(f.id);
      if (!stats || stats.totalResponses === 0) { showToast('No feedback data available for Excel.'); return; }
      let raw = [];
      try { raw = await dataService.getFacultyReportData(f.id); } catch (_) {}
      showToast(`Excel downloaded: ${generateFacultyExcel(f, raw, stats)}`, 'success');
    } catch (err) { showToast('Excel generation failed.'); }
  };

  const handleDeleteAccount = async () => {
    if (!deletePwd) { setDeleteErr('Enter your password to confirm.'); return; }
    setIsDeleting(true); setDeleteErr('');
    try { await dataService.deleteAccount(deletePwd); logoutUser(); navigate('/', { replace: true }); }
    catch (err) { setDeleteErr(err.message || 'Failed. Check your password.'); }
    finally { setIsDeleting(false); }
  };

  if (!currentUser) return null;

 // FIX: Allow passing the branch
  const secCount = (year, secName, branch = '') => {
    const k = isSH ? `${branch}__${year}__${secName}` : `${year}__${secName}`;
    return assignedCountBySec[k] || 0;
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <>
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'error' })} />

      <div className="dashboard-container">

        {/* HEADER */}
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo-small"><span>RISE</span></div>
            <div className="header-info">
              <h2>HoD Dashboard</h2>
              <div className="dept-badge">{currentUser.department} • {currentUser.college} College</div>
            </div>
          </div>
          <div className="header-right">
            <div className="user-info"><span className="user-icon">👤</span><span>{currentUser.name}</span></div>
            <button className="logout-btn btn-danger"
              onClick={() => { setDeletePwd(''); setDeleteErr(''); setShowDeleteModal(true); }}>
              🗑️ Delete Account
            </button>
            <button className="logout-btn" onClick={() => { logoutUser(); navigate('/', { replace: true }); }}>
              Logout ↩
            </button>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="dashboard-grid">

            {/* ═══════════════ LEFT CONFIG PANEL ═══════════════ */}
            <section className="panel config-panel">
              <div className="panel-header"><h3>⚙️ Configure</h3></div>

              <div className="cp-section-label">👥 Faculty Pool</div>
              <p className="pool-hint">Add faculty here, then use "+ Assign Faculty" in the right panel to place them in sections.</p>

              <div className="faculty-add-form">
                <input type="text" placeholder="Enter Faculty Full Name"
                  value={newFacultyName}
                  onChange={e => setNewFacultyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addOrUpdateFaculty()}
                  className="faculty-name-input" />
                <button type="button" className={`btn-add ${editingId ? 'btn-update' : ''}`}
                  onClick={addOrUpdateFaculty} disabled={isSaving}>
                  {isSaving ? '…' : editingId ? 'Update' : '+ Add'}
                </button>
                {editingId && (
                  <button type="button" className="btn-cancel-edit"
                    onClick={() => { setEditingId(null); setNewFacultyName(''); }}>✕</button>
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

              <div className="download-section">
                <h4 className="download-title">📥 Download Section Responses</h4>
                <select value={downloadYear} onChange={e => { setDownloadYear(e.target.value); setDownloadSection(''); }} className="download-select">
                  <option value="">Select Year</option>
                  {availableYears.map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
                <select value={downloadSection} onChange={e => setDownloadSection(e.target.value)} disabled={!downloadYear} className="download-select">
                  <option value="">{!downloadYear ? 'Select year first' : !downloadSections.length ? 'No completed sections' : 'Select Section'}</option>
                  {downloadSections.map(s => <option key={s.id} value={s.sectionName}>Section {s.sectionName} ✅</option>)}
                </select>
                <button type="button" className="btn-download"
                  onClick={() => {
                    if (!downloadYear || !downloadSection) { showToast('Select Year and a completed Section.'); return; }
                    showToast('Download format will be configured soon.', 'info');
                  }}>📥 Download</button>
              </div>
            </section>

            {/* ═══════════════ RIGHT FACULTY PANEL ═══════════════ */}
            <section className="panel list-panel">

              {/* Panel header */}
              <div className="lp-header">
                <div className="lp-title-block">
                  <h3>Faculty Dashboard</h3>
                  <span className="lp-sub">{assignedFaculty.length} assigned · {globalFacultyPool.length} in pool</span>
                </div>
                <button type="button" className="btn-assign-new"
                  onClick={openAssignModal} disabled={!globalFacultyPool.length}
                  title={!globalFacultyPool.length ? 'Add faculty to pool first' : ''}>
                  + Assign Faculty
                </button>
              </div>


              {/* ── S&H Layout ── */}
              {isSH ? (
                <div className="lp-body">
                  <div className="lp-year-row">
                    {availableBranches.map(branch => (
                      <button key={branch} type="button"
                        className={`year-chip ${selectedBranch === branch ? 'active' : ''}`}
                        onClick={() => { setSelectedBranch(branch); setSelectedSHSection(null); }}>
                        <span className="yc-label">{branch}</span>
                        <span className="yc-count">{assignedFaculty.filter(f => f.branch === branch).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="lp-main-area">
                    <div className="sec-nav">
                      <div className="sec-nav-header">Sections</div>
                      {!selectedBranch
                        ? <p className="sec-nav-empty">Select a branch</p>
                        : <>
                          <button type="button" className={`sec-nav-item ${!selectedSHSection ? 'active' : ''}`} onClick={() => setSelectedSHSection(null)}>
                            <span className="sni-name">All</span>
                            <span className="sni-badge">{assignedFaculty.filter(f => f.branch === selectedBranch).length}</span>
                          </button>
                          {(sectionsByKey[selectedBranch] || []).map(s => (
                            <SectionNavItem key={s.id} s={s}
                              count={secCount('I', s.sectionName, selectedBranch)}
                              isActive={selectedSHSection === s.sectionName}
                              isEditing={editingSection === s.id}
                              editName={editSectionName} editStrength={editSectionStrength}
                              onSelect={() => setSelectedSHSection(s.sectionName)}
                              onEdit={() => startEditSection(s)}
                              onDelete={() => deleteSection(s)}
                              onSave={() => saveEditSection(s.id)}
                              onCancel={() => setEditingSection(null)}
                              onChangeName={setEditSectionName}
                              onChangeStrength={setEditSectionStrength}
                            />
                          ))}
                        </>
                      }
                    </div>
                    <div className="fac-main">
                      {!selectedBranch
                        ? <EmptyState icon="📚" msg="Select a branch to view assignments" />
                        : !filteredFaculty.length
                          ? <EmptyState icon="🧑‍🏫" msg={`No assignments for ${selectedBranch}${selectedSHSection ? ' · ' + selectedSHSection : ''}`} sub="Use '+ Assign Faculty' above" />
                          : <FacultyTable rows={filteredFaculty} onDelete={deleteFaculty} onPDF={handleDownloadPDF} onExcel={handleDownloadExcel} />
                      }
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Normal department layout ── */
                <div className="lp-body">
                  <div className="lp-year-row">
                    {availableYears.map(y => (
                      <button key={y} type="button"
                        className={`year-chip ${selectedYear === y ? 'active' : ''}`}
                        onClick={() => { setSelectedYear(y); setSelectedSection(null); setEditingSection(null); }}>
                        <span className="yc-label">{y} Year</span>
                        <span className="yc-count">{assignedFaculty.filter(f => f.year === y).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="lp-main-area">
                    <div className="sec-nav">
                      <div className="sec-nav-header">Sections</div>
                      {!selectedYear
                        ? <p className="sec-nav-empty">Select a year</p>
                        : <>
                          <button type="button"
                            className={`sec-nav-item ${!selectedSection ? 'active' : ''}`}
                            onClick={() => { setSelectedSection(null); setEditingSection(null); }}>
                            <span className="sni-name">All</span>
                            <span className="sni-badge">{assignedFaculty.filter(f => f.year === selectedYear).length}</span>
                          </button>
                          {(sectionsByKey[selectedYear] || []).map(s => (
                            <SectionNavItem key={s.id} s={s}
                              count={secCount(selectedYear, s.sectionName)}
                              isActive={selectedSection === s.sectionName}
                              isEditing={editingSection === s.id}
                              editName={editSectionName} editStrength={editSectionStrength}
                              onSelect={() => { setSelectedSection(s.sectionName); setEditingSection(null); }}
                              onEdit={() => startEditSection(s)}
                              onDelete={() => deleteSection(s)}
                              onSave={() => saveEditSection(s.id)}
                              onCancel={() => setEditingSection(null)}
                              onChangeName={setEditSectionName}
                              onChangeStrength={setEditSectionStrength}
                            />
                          ))}
                          {!(sectionsByKey[selectedYear] || []).length && (
                            <p className="sec-nav-empty">No sections.<br />Use Manage Sections.</p>
                          )}
                        </>
                      }
                    </div>
                    <div className="fac-main">
                      {!selectedYear
                        ? <EmptyState icon="📂" msg="Select a year to begin" />
                        : !filteredFaculty.length
                          ? <EmptyState icon="🧑‍🏫"
                              msg={selectedSection ? `No faculty in Year ${selectedYear} › Sec ${selectedSection}` : `No assignments for Year ${selectedYear}`}
                              sub="Use '+ Assign Faculty' to add" />
                          : <FacultyTable rows={filteredFaculty} onDelete={deleteFaculty} onPDF={handleDownloadPDF} onExcel={handleDownloadExcel} />
                      }
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ═══════════════ LIVE FEED ═══════════════ */}
          <section className="live-feed-section">
            <div className="live-feed-header">
              <h3>📡 Published Feedback Links</h3>
              <span className="live-pill">● LIVE</span>
            </div>
            {!allBatches.length
              ? <div className="live-feed-empty">No published links yet. Hit "🚀 Publish Feedback Link" to get started.</div>
              : (
                <div className="live-feed-grid">
                  {allBatches.map(batch => {
                    const resp  = batch.responseCount || 0;
                    const total = batch.totalStudents  || 0;
                    const pct   = total > 0 ? Math.min(100, Math.round((resp / total) * 100)) : 0;
                    const now   = new Date();
                    const live  = batch.slotStartDate && batch.slotEndDate
                      && now >= new Date(batch.slotStartDate) && now <= new Date(batch.slotEndDate);
                    return (
                      <div key={batch.id} className={`lfc ${live ? 'lfc--live' : 'lfc--ended'}`}>
                        <div className="lfc-top">
                          <span className={`lfc-status ${live ? 'live' : 'ended'}`}>{live ? '🟢 LIVE' : '⚫ ENDED'}</span>
                          <span className="lfc-slot">Slot {batch.slot}</span>
                        </div>
                        <div className="lfc-identity">
                          <span>Year {batch.year}</span><span className="lfc-dot">·</span>
                          <span>Sem {batch.sem}</span><span className="lfc-dot">·</span>
                          <span>Sec {batch.sec}</span>
                        </div>
                        <div className="lfc-dates">
                          📅 {batch.slotStartDate ? new Date(batch.slotStartDate).toLocaleDateString('en-IN') : '—'}
                          {' → '}
                          {batch.slotEndDate ? new Date(batch.slotEndDate).toLocaleDateString('en-IN') : '—'}
                        </div>
                        <div className="lfc-progress-row">
                          <span className="lfc-resp-count">{resp}/{total}</span>
                          <div className="lfc-bar"><div className="lfc-fill" style={{ width: `${pct}%` }} /></div>
                          <span className="lfc-pct">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </section>
          )}
        </section>

          {/* ═══════════════ NEW POOL PANEL (GRID) ═══════════════ */}
          <section className="panel pool-panel" style={{ marginTop: '24px' }}>
            <div className="panel-header">
              <h3>👥 Faculty Pool <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', color: '#475569' }}>{globalFacultyPool.length} Unassigned</span></h3>
            </div>
            {!globalFacultyPool.length ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <span className="empty-icon">👥</span>
                <p>No unassigned faculty in the pool.</p>
              </div>
            ) : (
              <div className="pool-grid">
                {globalFacultyPool.map(f => (
                  <div key={f.id} className="pool-grid-card">
                    <div className="pgc-left">
                      <span className="pgc-name">{f.name}</span>
                      <span className="pgc-code">{f.code}</span>
                    </div>
                    <div className="pgc-actions">
                      <button type="button" className="pgc-btn chip-edit" title="Edit"
                        onClick={() => { setNewFacultyName(f.name); setEditingId(f.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>✏️</button>
                      <button type="button" className="pgc-btn chip-delete" title="Remove"
                        onClick={() => deleteFaculty(f.id)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </main>

        {/* ═══════════════ PUBLISH MODAL ═══════════════ */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content publish-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🔗 Publish Feedback Link</h2>
                <p>{publishStep === 1 ? 'Step 1 — Configure slot & section' : 'Step 2 — Review & confirm'}</p>
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
                  <div className="form-field">
                    <label>Select Slot</label>
                    {(() => {
                      const ty  = isSH ? 'I' : publishYear;
                      const s1d = allBatches.some(b => b.year === ty && b.sem === publishSem && b.sec === publishSection && b.slot === 1);
                      const s2d = allBatches.some(b => b.year === ty && b.sem === publishSem && b.sec === publishSection && b.slot === 2);
                      return (
                        <div className="slot-btn-row">
                          <button type="button" disabled={s1d}
                            className={`slot-btn ${slotNumber === 1 && !s1d ? 'active' : ''} ${s1d ? 'done' : ''}`}
                            onClick={() => !s1d && setSlotNumber(1)}>
                            {s1d ? '✅ Slot 1 Done' : '📋 Slot 1 — Previous'}
                          </button>
                          <button type="button" disabled={!s1d || s2d}
                            className={`slot-btn ${slotNumber === 2 ? 'active' : ''} ${s2d ? 'done' : ''}`}
                            onClick={() => s1d && !s2d && setSlotNumber(2)}>
                            {s2d ? '✅ Slot 2 Done' : !s1d ? '🔒 Slot 2 (Locked)' : '📋 Slot 2 — Latest'}
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
                  <p className="publish-review-hint">Uncheck any faculty to exclude from this link.</p>
                  {!publishSectionFaculty.length
                    ? <div className="publish-no-faculty">⚠️ No faculty assigned to this section for Semester {publishSem}.</div>
                    : (
                      <table className="publish-faculty-table">
                        <thead><tr><th>#</th><th>Faculty Name</th><th>Subject</th><th>Include</th></tr></thead>
                        <tbody>
                          {publishSectionFaculty.map((f, i) => (
                            <tr key={f.id} className={selFacIds.includes(f.id) ? 'row-selected' : ''}>
                              <td>{i + 1}</td><td><strong>{f.name}</strong></td>
                              <td>{f.subject || '—'}</td>
                              <td>
                                <input type="checkbox" checked={selFacIds.includes(f.id)}
                                  onChange={() => setSelFacIds(prev => prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                                  style={{ accentColor: '#0ea5e9', width: 16, height: 16 }} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  }
                </div>
              )}
              <div className="modal-footer">
                {publishStep === 1
                  ? <><button className="btn-confirm" onClick={handlePublishProceed}>Proceed →</button><button className="btn-modal-cancel" onClick={() => setShowModal(false)}>Cancel</button></>
                  : <><button className="btn-confirm" onClick={confirmPublish} disabled={isPublishing}>{isPublishing ? '⏳ Publishing…' : '✅ Confirm & Publish'}</button><button className="btn-modal-cancel" onClick={() => setPublishStep(1)}>← Back</button></>
                }
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ASSIGN FACULTY MODAL ═══════════════ */}
        {showAssignModal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal-content assign-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📌 Assign Faculty</h2>
                <div className="step-indicator">
                  {[1,2,3].map(n => (
                    <div key={n} className={`step-dot ${assignStep === n ? 'active' : assignStep > n ? 'done' : ''}`}>
                      {assignStep > n ? '✓' : n}
                    </div>
                  ))}
                </div>
                <p>{assignStep === 1 ? 'Year & Semester' : assignStep === 2 ? 'Subjects for this semester' : 'Assign faculty per subject & section'}</p>
              </div>
              <div className="modal-body">
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
                {assignStep === 2 && (
                  <div className="assign-step">
                    <div className="step-context-badge">{!isSH && `Year ${assignYear} · `}Semester {assignSem}</div>
                    <div className="form-field">
                      <label>Number of subjects this semester</label>
                      <input type="number" min="1" max="10" value={assignSubjectCount}
                        onChange={e => {
                          const n = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                          setAssignSubjectCount(n);
                          setAssignSubjectNames(prev => { const a = [...prev]; while (a.length < n) a.push(''); return a.slice(0, n); });
                        }} style={{ width: '100px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Array.from({ length: assignSubjectCount }, (_, i) => (
                        <div className="form-field" key={i}>
                          <label>Subject {i + 1}</label>
                          <input type="text"
                            placeholder={['Data Structures', 'Computer Networks', 'DBMS', 'OS', 'Algorithms'][i] || 'Subject Name'}
                            value={assignSubjectNames[i] || ''}
                            onChange={e => { const a = [...assignSubjectNames]; a[i] = e.target.value; setAssignSubjectNames(a); }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {assignStep === 3 && (
                  <div className="assign-step">
                    <div className="step-context-badge">{!isSH && `Year ${assignYear} · `}Semester {assignSem} · {assignRows.length} subject{assignRows.length !== 1 ? 's' : ''}</div>
                    {assignRows.map((row, i) => (
                      <div key={i} className="assign-row-card">
                        <div className="arc-subject">📚 {row.subjectName}</div>
                        <div className="arc-selects">
                          <div>
                            <label>Section</label>
                            <select value={row.section}
                              onChange={e => { const a = [...assignRows]; a[i] = { ...a[i], section: e.target.value }; setAssignRows(a); }}>
                              <option value="">— Section —</option>
                              {(sectionsByKey[isSH ? selectedBranch : assignYear] || []).map(s => (
                                <option key={s.id} value={s.sectionName}>{s.sectionName}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Faculty from Pool</label>
                            <select value={row.facultyId}
                              onChange={e => { const a = [...assignRows]; a[i] = { ...a[i], facultyId: e.target.value }; setAssignRows(a); }}>
                              <option value="">— Faculty —</option>
                              {globalFacultyPool.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {assignStep === 1 && <><button className="btn-confirm" onClick={handleAssignStep1}>Next →</button><button className="btn-modal-cancel" onClick={() => setShowAssignModal(false)}>Cancel</button></>}
                {assignStep === 2 && <><button className="btn-confirm" onClick={handleAssignStep2}>Next →</button><button className="btn-modal-cancel" onClick={() => setAssignStep(1)}>← Back</button></>}
                {assignStep === 3 && <><button className="btn-confirm" onClick={handleAssignFaculty} disabled={isAssigning}>{isAssigning ? '⏳ Assigning…' : '✅ Assign All'}</button><button className="btn-modal-cancel" onClick={() => setAssignStep(2)}>← Back</button></>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ MANAGE SECTIONS MODAL ═══════════════ */}
        {showSectionModal && (
          <div className="modal-overlay" onClick={() => setShowSectionModal(false)}>
            <div className="modal-content sections-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗂️ Manage Class Sections</h2>
                <p>{isSH ? 'Configure sections per department (1st year).' : `Set up sections for each year. ${TWO_YEAR_DEPTS.includes(currentUser?.department) ? 'Years I & II.' : 'Years II, III & IV.'}`}</p>
              </div>
              <div className="sections-modal-body">
                <div className="syb-grid">
                  {(isSH ? availableBranches : availableYears).map(key => (
                    <div key={key} className="syb-block">
                      <div className="syb-header">
                        <span>{isSH ? `📖 ${key}` : `📅 Year ${key}`}</span>
                        <span className="syb-count">{(sectionsByKey[key] || []).length} section{(sectionsByKey[key] || []).length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="syb-body">
                        <div className="existing-chips">
                          {!(sectionsByKey[key] || []).length && <span className="no-secs">No sections yet.</span>}
                          {(sectionsByKey[key] || []).map(s => (
                            <div key={s.id} className="esc-chip">
                              <span className="esc-name">{s.sectionName}</span>
                              {editStrengthId === s.id ? (
                                <>
                                  <input type="number" value={editStrengthVal} onChange={e => setEditStrengthVal(e.target.value)} className="esc-str-input" autoFocus />
                                  <button type="button" className="esc-btn esc-save" onClick={async () => { await sectionAPI.update(s.id, { strength: Number(editStrengthVal) }); setSections(prev => prev.map(x => x.id === s.id ? { ...x, strength: Number(editStrengthVal) } : x)); setEditStrengthId(null); }}>✓</button>
                                  <button type="button" className="esc-btn esc-cancel" onClick={() => setEditStrengthId(null)}>✕</button>
                                </>
                              ) : (
                                <span className="esc-strength" title="Click to edit" onClick={() => { setEditStrengthId(s.id); setEditStrengthVal(String(s.strength || 0)); }}>{s.strength || 0}👤</span>
                              )}
                              <button type="button" className="esc-btn esc-delete" onClick={async () => { if (!window.confirm(`Delete "${s.sectionName}"?`)) return; await sectionAPI.delete(s.id); setSections(prev => prev.filter(x => x.id !== s.id)); }}>🗑</button>
                            </div>
                          ))}
                        </div>
                        <div className="add-sec-row">
                          <input type="text" placeholder="Name (e.g. A, B, CSE-A)"
                            value={sectionForm.key === key ? sectionForm.sectionName : ''}
                            onChange={e => setSectionForm({ key, sectionName: e.target.value, strength: sectionForm.key === key ? sectionForm.strength : '', applyAll: sectionForm.key === key ? sectionForm.applyAll : false })}
                            className="add-sec-name" />
                          <input type="number" placeholder="Strength"
                            value={sectionForm.key === key ? sectionForm.strength : ''}
                            onChange={e => setSectionForm(f => ({ ...f, key, strength: e.target.value }))}
                            className="add-sec-strength" />
                          {!isSH && (
                            <label className="apply-all-lbl">
                              <input type="checkbox"
                                checked={!!(sectionForm.key === key && sectionForm.applyAll)}
                                onChange={e => setSectionForm(f => ({ ...f, key, applyAll: e.target.checked }))} />
                              All years
                            </label>
                          )}
                          <button type="button" className="btn-add-sec" onClick={async () => {
                            setSectionError('');
                            const name     = (sectionForm.key === key ? sectionForm.sectionName : '').trim();
                            const strength = Number(sectionForm.key === key ? sectionForm.strength : 0) || 0;
                            const applyAll = sectionForm.key === key ? !!sectionForm.applyAll : false;
                            if (!name) { setSectionError('Section name is required.'); return; }
                            try {
                              if (!isSH && applyAll) {
                                const newSecs = [];
                                for (const yr of availableYears) { const res = await sectionAPI.create({ year: yr, branch: '', sectionName: name, strength }); newSecs.push(res.data.section); }
                                setSections(prev => [...prev, ...newSecs]);
                              } else {
                                const res = await sectionAPI.create({ year: isSH ? 'I' : key, branch: isSH ? key : '', sectionName: name, strength });
                                setSections(prev => [...prev, res.data.section]);
                              }
                              setSectionForm({ key: null, sectionName: '', strength: '', applyAll: false });
                            } catch (err) { setSectionError(err.response?.data?.error || 'Failed to add section.'); }
                          }}>+ Add</button>
                        </div>
                        {sectionError && sectionForm.key === key && <p className="sec-err">{sectionError}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-confirm" onClick={() => setShowSectionModal(false)}>✅ Done</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Account Modal ── */}
        {showDeleteModal && (
          <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>🗑️ Delete Account</h3></div>
              <div style={{ padding: '20px' }}>
                <div className="delete-warn-box">⚠️ This will permanently delete the HoD account for <strong>{currentUser.department} — {currentUser.college}</strong>. Cannot be undone.</div>
                <div className="form-field" style={{ margin: '16px 0' }}>
                  <label>Enter your password to confirm:</label>
                  <input type="password" value={deletePwd} onChange={e => { setDeletePwd(e.target.value); setDeleteErr(''); }} placeholder="Current password" autoComplete="current-password" />
                </div>
                {deleteErr && <div className="delete-error">⚠️ {deleteErr}</div>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleDeleteAccount} disabled={isDeleting}
                    style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', fontWeight: '700', background: isDeleting ? '#ccc' : '#e74c3c', color: '#fff', cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                    {isDeleting ? 'Deleting…' : '🗑️ Yes, Delete'}
                  </button>
                  <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="btn-modal-cancel">Cancel</button>
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

/* ═══════════════ Sub-components ═══════════════ */

function SectionNavItem({ s, count, isActive, isEditing, editName, editStrength, onSelect, onEdit, onDelete, onSave, onCancel, onChangeName, onChangeStrength }) {
  if (isEditing) {
    return (
      <div className="sec-nav-edit">
        <input value={editName} onChange={e => onChangeName(e.target.value)} className="sne-name-input" placeholder="Name" autoFocus />
        <input type="number" value={editStrength} onChange={e => onChangeStrength(e.target.value)} className="sne-str-input" placeholder="Strength" />
        <div className="sne-actions">
          <button type="button" className="sne-btn sne-save" onClick={onSave} title="Save">✓</button>
          <button type="button" className="sne-btn sne-cancel" onClick={onCancel} title="Cancel">✕</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`sec-nav-item-wrap ${isActive ? 'sec-wrap-active' : ''}`}>
      <button type="button" className={`sec-nav-item ${isActive ? 'active' : ''}`} onClick={onSelect}>
        <span className="sni-name">{s.sectionName}</span>
        <span className="sni-right">
          <span className="sni-strength">{s.strength || 0}👤</span>
          <span className="sni-badge">{count}</span>
        </span>
      </button>
      <div className="sni-hover-actions">
        <button type="button" className="sni-act sni-edit" onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit">✏️</button>
        <button type="button" className="sni-act sni-del"  onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete">🗑</button>
      </div>
    </div>
  );
}

function FacultyTable({ rows, onDelete, onPDF, onExcel }) {
  return (
    <div className="fac-table-wrap">
      <table className="fac-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Faculty Name</th>
            <th>Subject</th>
            <th>Sem · Sec</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(f => (
            <tr key={f.id} className="fac-tr">
              <td><span className="ft-code">{f.code}</span></td>
              <td className="ft-name">{f.name}</td>
              <td className="ft-subject">{f.subject || <span className="ft-empty">—</span>}</td>
              <td><span className="ft-badge">Sem {f.sem} · {f.sec}</span></td>
              <td>
                <div className="ft-actions">
                  <button type="button" className="fta-btn fta-del" onClick={() => onDelete(f.id)} title="Remove">🗑</button>
                  <button type="button" className="fta-btn fta-pdf" onClick={() => onPDF(f)} title="Download PDF">📄</button>
                  <button type="button" className="fta-btn fta-xls" onClick={() => onExcel(f)} title="Download Excel">📊</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ icon, msg, sub }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p>{msg}</p>
      {sub && <p className="empty-sub">{sub}</p>}
    </div>
  );
}

export default HoDDashboard;
