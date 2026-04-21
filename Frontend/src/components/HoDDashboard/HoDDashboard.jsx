import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService.js';
import { sectionAPI } from '../../services/api.js';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import './HoDDashboard.css';
import { generateFacultyPDF, generateAbstractPDF } from '../../utils/pdfGenerator';
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

/* ─── group faculty for UI tables ─── */
function groupFacultyRecords(facultyList) {
  const groupedMap = new Map();
  facultyList.forEach(f => {
    const key = `${f.name}|${f.subject}|${f.sem}`;
    if (!groupedMap.has(key)) {
      groupedMap.set(key, { ...f, ids: [f.id], allSecs: [f.sec], records: [f] });
    } else {
      const existing = groupedMap.get(key);
      existing.ids.push(f.id);
      if (!existing.allSecs.includes(f.sec)) existing.allSecs.push(f.sec);
      existing.records.push(f);
    }
  });
  return Array.from(groupedMap.values());
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

  // ─── CURRICULUM STATE (Saved to LocalStorage - GHOSTING FIXED) ───
  const [curriculum, setCurriculum] = useState({});
  const isCurriculumLoaded = useRef(false);

  // Safely load ONLY when currentUser is fully resolved
  useEffect(() => {
    if (currentUser && !isCurriculumLoaded.current) {
      const stored = localStorage.getItem(`curriculum_${currentUser.college}_${currentUser.department}`);
      if (stored) setCurriculum(JSON.parse(stored));
      isCurriculumLoaded.current = true;
    }
  }, [currentUser]);

  // Safely save ONLY after it has been properly loaded
  useEffect(() => {
    if (currentUser && isCurriculumLoaded.current) {
      localStorage.setItem(`curriculum_${currentUser.college}_${currentUser.department}`, JSON.stringify(curriculum));
    }
  }, [curriculum, currentUser]);

  // ─── DEFINE SUBJECTS MODAL ───
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subStep,          setSubStep]          = useState(1);
  const [subYear,          setSubYear]          = useState('');
  const [subBranch,        setSubBranch]        = useState('');
  const [subSem,           setSubSem]           = useState('');
  const [subCount,         setSubCount]         = useState(1);
  const [subNames,         setSubNames]         = useState(['']);
  const [subSections,      setSubSections]      = useState([]);

  // ─── ASSIGN FACULTY MODAL ───
  const [showAssignModal,  setShowAssignModal]  = useState(false);
  const [assignStep,       setAssignStep]       = useState(1);
  const [assignYear,       setAssignYear]       = useState('');
  const [assignBranch,     setAssignBranch]     = useState('');
  const [assignSem,        setAssignSem]        = useState('');
  const [assignSection,    setAssignSection]    = useState('');
  const [assignSelections, setAssignSelections] = useState({}); // { "Subject A": "FacID", "Subject B": "FacID" }
  const [isAssigning,      setIsAssigning]      = useState(false);

  // ─── PUBLISH MODAL ───
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

// Link modal (shown after successful publish)
  const [linkModal, setLinkModal] = useState({ show: false, url: '' });

  // Generic confirm modal (replaces window.confirm everywhere)
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', pendingAction: null });
  const showConfirm = useCallback((message, action) => {
    setConfirmModal({ show: true, message, pendingAction: action });
  }, []);

  // Edit profile modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm,      setProfileForm]      = useState({ name: '', email: '', mobile: '' });
  const [profilePwdForm,   setProfilePwdForm]   = useState({ currentPwd: '', newPwd: '', confirmPwd: '' });
  const [profileTab,       setProfileTab]       = useState('details');
  const [profileErr,       setProfileErr]       = useState('');
  const [isSavingProfile,  setIsSavingProfile]  = useState(false);

  // Academic year
  const [academicYear, setAcademicYear] = useState(() =>
    localStorage.getItem('academicYear') || (() => {
      const y = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      return `${y}-${String(y + 1).slice(-2)}`;
    })()
  );

  /* ── Toast ── */
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const showToast = useCallback((message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'error' }), 4000);
  }, []);

  const [hintDismissed, setHintDismissed] = useState(() => sessionStorage.getItem('hodScrollHintClosed') === 'true');
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = 0;
    const handleScroll = (e) => {
      const currentScrollY = window.scrollY || (e.target && e.target.scrollTop) || 0;
      if (currentScrollY < 50) setHintVisible(true);
      else if (currentScrollY > lastScrollY + 10) setHintVisible(false);
      else if (currentScrollY < lastScrollY - 10) setHintVisible(true);
      lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const dismissScrollHint = () => {
    setHintDismissed(true);
    sessionStorage.setItem('hodScrollHintClosed', 'true');
  };

  /* ────────────────────────────────────────
     Data loading
  ──────────────────────────────────────── */  
  const loadDashboardData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const dashData = await dataService.getHoDDashboard();
      if (dashData.faculty !== undefined) {
        setFacultyList(prev => {
          const newData = dashData.faculty.map(normalizeFaculty);
          return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
        });
      }
      if (dashData.batches !== undefined) {
        setAllBatches(prev => JSON.stringify(prev) === JSON.stringify(dashData.batches) ? prev : dashData.batches);
      }
    } catch (e) { console.warn('Backend unavailable'); }
  }, [currentUser]);

  const loadSections = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'hod') return;
    try {
      const res = await sectionAPI.getAll();
      setSections(res.data.sections || []);
    } catch (e) { console.warn('Could not load sections'); }
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
    
    const payload = {
      name: trimmed, subject: 'TBD', year: '',
      branch: isSH ? (selectedBranch || '') : currentUser.department,
      sem: '', sec: '', dept: currentUser.department, college: currentUser.college,
    };
    
    setIsSaving(true);
    try {
      if (editingId) {
        await dataService.updateFaculty(editingId, payload);
        // Instant Local Update
        setFacultyList(prev => prev.map(f => f.id === editingId ? { ...f, name: trimmed } : f));
        setEditingId(null);
        showToast('Faculty updated.', 'success');
      } else {
        const res = await dataService.createFaculty(payload);
        // Instant Local Update (Inject the new faculty returned from the server immediately)
        if (res.faculty) setFacultyList(prev => [...prev, normalizeFaculty(res.faculty)]);
        showToast(`${trimmed} added to pool.`, 'success');
      }
      setNewFacultyName('');
    } catch (err) { 
      showToast(err.message || 'Failed to save faculty.'); 
    } finally { 
      setIsSaving(false); 
      loadDashboardData(); // Silent background sync
    }
  };

 const deleteFaculty = (ids, subjectName = '') => {
    const msg = subjectName
      ? `Remove assignment for "${subjectName}"? They will be removed from ALL sections they teach this specific subject in.`
      : 'Remove this faculty?';
    const idArray = Array.isArray(ids) ? ids : [ids];
    showConfirm(msg, async () => {
      setFacultyList(prev => prev.filter(f => !idArray.includes(f.id)));
      try {
        for (const id of idArray) { await dataService.deleteFacultyById(id); }
        await loadDashboardData();
        showToast('Successfully deleted.', 'success');
      } catch (err) {
        showToast(err.message || 'Delete failed.');
        await loadDashboardData();
      }
    });
  };

 const handleDeleteCurriculum = (key) => {
    showConfirm("Delete these semester subjects? You can define new ones anytime.", () => {
      setCurriculum(prev => {
        const c = { ...prev };
        delete c[key];
        return c;
      });
      showToast('Subjects deleted.', 'success');
    });
  };

  const clearFacultyPool = () => {
    showConfirm('🗑️ Delete ALL unassigned faculty from the pool to add fresh faces for the new semester?', async () => {
      setIsSaving(true);
      try {
        for (const f of globalFacultyPool) { await dataService.deleteFacultyById(f.id); }
        await loadDashboardData();
        showToast('Pool cleared successfully.', 'success');
      } catch (err) { showToast('Failed to clear pool.'); }
      finally { setIsSaving(false); }
    });
  };

  const clearAllAssignments = () => {
    showConfirm('⚠️ DANGER: Remove ALL assigned faculty from all sections? This resets the dashboard for a new semester.', async () => {
      setIsSaving(true);
      try {
        for (const f of assignedFaculty) { await dataService.deleteFacultyById(f.id); }
        await loadDashboardData();
        showToast('All assignments cleared.', 'success');
      } catch (err) { showToast('Failed to clear assignments.'); }
      finally { setIsSaving(false); }
    });
  };

  /* ═══════════════ DEFINE SUBJECTS (CURRICULUM) WORKFLOW ═══════════════ */
  const openSubjectModal = () => {
    setSubStep(1); setSubYear(''); setSubBranch(''); setSubSem('');
    setSubCount(1); setSubNames(['']); setSubSections([]);
    setShowSubjectModal(true);
  };

  const handleSubStep1 = () => {
    if (isSH && !subBranch) { showToast('Select a Branch.'); return; }
    if (!isSH && !subYear) { showToast('Select a Year.'); return; }
    if (!subSem) { showToast('Select a Semester.'); return; }
    setSubStep(2);
  };

  const handleSubStep2 = () => {
    const valid = subNames.map(s => s.trim()).filter(Boolean);
    if (!valid.length) { showToast('Enter at least one subject name.'); return; }
    setSubStep(3);
  };

  const handleSaveSubjects = () => {
    if (subSections.length === 0) { showToast('Select at least one section.'); return; }
    const key = isSH ? `${subBranch}_${subSem}` : `${subYear}_${subSem}`;
    
    setCurriculum(prev => ({
      ...prev,
      [key]: {
        subjects: subNames.map(s => s.trim()).filter(Boolean),
        sections: subSections
      }
    }));
    
    showToast('Semester subjects saved to curriculum!', 'success');
    setShowSubjectModal(false);
  };

  /* ═══════════════ ASSIGN FACULTY WORKFLOW (NEW) ═══════════════ */
  const openAssignModal = () => {
    if (!globalFacultyPool.length) { showToast('Add faculty to the pool first.'); return; }
    if (Object.keys(curriculum).length === 0) { showToast('Please define subjects for the semester first using "+ Define Subjects".'); return; }
    setAssignStep(1); setAssignYear(''); setAssignBranch(''); setAssignSem('');
    setAssignSection(''); setAssignSelections({});
    setShowAssignModal(true);
  };

  const handleAssignStep1 = () => {
    if (isSH && !assignBranch) { showToast('Select a Branch.'); return; }
    if (!isSH && !assignYear) { showToast('Select a Year.'); return; }
    if (!assignSem) { showToast('Select a Semester.'); return; }
    setAssignStep(2);
  };

  const handleAssignStep2 = () => {
    if (!assignSection) { showToast('Select a Section.'); return; }
    const key = isSH ? `${assignBranch}_${assignSem}` : `${assignYear}_${assignSem}`;
    if (!curriculum[key] || !curriculum[key].sections.includes(assignSection)) {
      showToast(`No subjects defined for Sec ${assignSection} in Sem ${assignSem}. Define them first!`); 
      return;
    }
    
    // Auto-populate table rows based on defined subjects
    const initial = {};
    curriculum[key].subjects.forEach(s => initial[s] = '');
    setAssignSelections(initial);
    setAssignStep(3);
  };

  const handleAssignFaculty = async () => {
    const assignments = Object.entries(assignSelections).filter(([sub, fac]) => fac);
    if (assignments.length === 0) { showToast('Please assign a faculty to at least one subject.'); return; }
    
    setIsAssigning(true);
    let savedCount = 0;
    let failed = [];
    
    try {
      // 1. Blast all requests to the backend AT THE SAME TIME (Parallel)
      const assignmentPromises = assignments.map(async ([subject, facId]) => {
        const faculty = globalFacultyPool.find(f => String(f.id) === String(facId));
        if (!faculty) return;
        
        try {
          const res = await dataService.createFaculty({
            name: faculty.name,
            subject: subject,
            year: isSH ? 'I' : assignYear,
            branch: isSH ? assignBranch : currentUser.department,
            sem: assignSem,
            sec: assignSection,
            dept: currentUser.department,
            college: currentUser.college,
          });
          savedCount++;
          return normalizeFaculty(res.faculty); // Return the newly created record
        } catch (err) {
          failed.push(subject);
          return null;
        }
      });

      // Wait for all parallel requests to finish
      const newRecords = (await Promise.all(assignmentPromises)).filter(Boolean);

      // 2. Instantly update the local UI state without doing a massive database refetch!
      setFacultyList(prev => [...prev, ...newRecords]);

      if (failed.length > 0) {
        showToast(`${savedCount} saved. Failed: ${failed.join(', ')}`, 'error');
      } else {
        showToast(`Successfully assigned ${savedCount} faculty!`, 'success');
        setShowAssignModal(false); // Close modal instantly!
      }
    } catch (err) {
      showToast(err.message || 'Assignment failed.');
    } finally {
      setIsAssigning(false);
      // 3. Do a silent background sync just to be completely safe, but don't force the user to wait for it.
      loadDashboardData(); 
    }
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
        setShowModal(false);
        setLinkModal({ show: true, url: full });
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
      loadDashboardData();
    } catch (err) { showToast('Failed to update section.'); }
  };

  const deleteSection = (s) => {
    showConfirm(`Delete section "${s.sectionName}"? Cannot be undone.`, async () => {
      try {
        await sectionAPI.delete(s.id);
        setSections(prev => prev.filter(x => x.id !== s.id));
        if (selectedSection === s.sectionName) setSelectedSection(null);
      } catch (err) { showToast('Failed to delete section.'); }
    });
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

 /* ── Revoke batch ── */
  const handleRevokeBatch = (batch) => {
    showConfirm(
      `Revoke feedback link for Year ${batch.year} · Sem ${batch.sem} · Sec ${batch.sec}? This permanently DELETES all ${batch.responseCount || 0} submitted responses and closes the link.`,
      async () => {
        try {
          await dataService.revokeBatch(batch.id);
          await loadDashboardData();
          showToast('Batch revoked and all responses wiped.', 'success');
        } catch (err) { showToast(err.message || 'Failed to revoke.'); }
      }
    );
  };

  /* ── Profile handlers ── */
  const openProfileModal = () => {
    setProfileForm({ name: currentUser.name || '', email: currentUser.email || '', mobile: currentUser.mobile || '' });
    setProfilePwdForm({ currentPwd: '', newPwd: '', confirmPwd: '' });
    setProfileTab('details'); setProfileErr('');
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    setProfileErr('');
    if (!profileForm.name.trim()) { setProfileErr('Name is required.'); return; }
    setIsSavingProfile(true);
    try {
      await dataService.updateProfile(profileForm);
      showToast('Profile updated successfully.', 'success');
      setShowProfileModal(false);
    } catch (err) { setProfileErr(err.message || 'Failed to update.'); }
    finally { setIsSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    setProfileErr('');
    if (!profilePwdForm.currentPwd) { setProfileErr('Enter your current password.'); return; }
    if (!profilePwdForm.newPwd) { setProfileErr('Enter a new password.'); return; }
    if (profilePwdForm.newPwd !== profilePwdForm.confirmPwd) { setProfileErr('New passwords do not match.'); return; }
    if (profilePwdForm.newPwd.length < 8) { setProfileErr('Password must be at least 8 characters.'); return; }
    setIsSavingProfile(true);
    try {
      await dataService.changePassword({ current_password: profilePwdForm.currentPwd, new_password: profilePwdForm.newPwd });
      showToast('Password changed successfully.', 'success');
      setShowProfileModal(false);
    } catch (err) { setProfileErr(err.message || 'Failed to change password.'); }
    finally { setIsSavingProfile(false); }
  };

  /* ── Abstract PDF download ── */
  const handleDownloadAbstract = async (year, sec) => {
    const secFaculty = assignedFaculty.filter(f => f.year === year && f.sec === sec);
    if (!secFaculty.length) { showToast('No assigned faculty for this section.'); return; }
    showToast('Building abstract PDF…', 'info');
    try {
      const facultyWithStats = await Promise.all(secFaculty.map(async f => {
        const stats = await dataService.getFacultyStats(f.id);
        return { faculty: f, stats };
      }));
      const suggestions = facultyWithStats
        .filter(item => item.stats)
        .map(item => {
          const sd = item.stats.hasSlot2 ? item.stats.slot2 : item.stats.slot1;
          if (!sd) return null;
          const sorted = Object.entries(sd.parameterStats || {}).sort(([, a], [, b]) => a.average - b.average);
          const low = sorted[0];
          return {
            name: item.faculty.name,
            suggestion: low ? `Needs improvement in "${low[0]}" (avg ${low[1].average}/10).` : 'No specific concerns.',
          };
        }).filter(Boolean);
      const batch = allBatches.find(b => b.year === year && b.sec === sec);
      const sem = batch?.sem || downloadSection || '?';
      generateAbstractPDF(currentUser.college, currentUser.department, { year, sem, sec }, facultyWithStats, suggestions);
      showToast('Abstract downloaded!', 'success');
    } catch (err) { showToast('Failed to generate abstract.'); }
  };

  useEffect(() => {
    localStorage.setItem('academicYear', academicYear);
  }, [academicYear]);

  if (!currentUser) return null;

  const secCount = (year, secName, branch = '') => {
    const k = isSH ? `${branch}__${year}__${secName}` : `${year}__${secName}`;
    return assignedCountBySec[k] || 0;
  };

/* ═══════════════ RENDER ═══════════════ */
  return (
    <>
      <Toast toast={toast} onClose={() => setToast({ show: false, message: '', type: 'error' })} />

      {!hintDismissed && (
        <div className={`scroll-hint-wrapper ${hintVisible ? 'visible' : 'hidden'}`}>
          <div className="scroll-hint-card">
            <span>👇 Scroll down for Published Links & Subject Curriculum</span>
            <button onClick={dismissScrollHint} title="Dismiss">✕</button>
          </div>
        </div>
      )}

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
            <button className="logout-btn" style={{ background: '#7c3aed' }}
              onClick={openProfileModal}>
              ✏️ Edit Profile
            </button>
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
              <p className="pool-hint">Add faculty here before assigning them to subjects.</p>

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
                <h4 className="download-title">🗓️ Academic Year</h4>
                <input type="text" value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2024-25" className="download-select"
                  style={{ marginBottom: '10px', fontWeight: '700', textAlign: 'center' }} />
              </div>

              <div className="download-section">
                <h4 className="download-title">📥 Download Abstract PDF</h4>
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
                    handleDownloadAbstract(downloadYear, downloadSection);
                  }}>📥 Download Abstract</button>
              </div>
            </section>

            {/* ═══════════════ RIGHT FACULTY PANEL ═══════════════ */}
            <section className="panel list-panel">
              <div className="lp-header">
                <div className="lp-title-block">
                  <h3>Faculty Dashboard</h3>
                  <span className="lp-sub">{groupFacultyRecords(assignedFaculty).length} assigned · {globalFacultyPool.length} in pool</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {assignedFaculty.length > 0 && (
                    <button type="button" className="btn-assign-new" style={{ background: 'white', border: '1px solid #ef4444', color: '#ef4444' }} onClick={clearAllAssignments} disabled={isSaving}>
                      {isSaving ? '⏳...' : '🔄 Reset All Assignments'}
                    </button>
                  )}
                  <button type="button" className="btn-assign-new" style={{ background: '#64748b' }} onClick={openSubjectModal}>
                    + Define Subjects
                  </button>
                  <button type="button" className="btn-assign-new" onClick={openAssignModal} disabled={!globalFacultyPool.length}>
                    + Assign Faculty
                  </button>
                </div>
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
                        <span className="yc-count">{groupFacultyRecords(assignedFaculty.filter(f => f.branch === branch)).length}</span>
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
                            <span className="sni-badge">{groupFacultyRecords(assignedFaculty.filter(f => f.branch === selectedBranch)).length}</span>
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
                        <span className="yc-count">{groupFacultyRecords(assignedFaculty.filter(f => f.year === y)).length}</span>
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
                            <span className="sni-badge">{groupFacultyRecords(assignedFaculty.filter(f => f.year === selectedYear)).length}</span>
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
                    const endOfDay = batch.slotEndDate
  ? new Date(new Date(batch.slotEndDate).getTime() + 86400000 - 1)
  : null;
const live = batch.slotStartDate && endOfDay
  && now >= new Date(batch.slotStartDate)
  && now <= endOfDay;
                    return (
                      <div key={batch.id} className={`lfc ${live ? 'lfc--live' : 'lfc--ended'}`}>
                        <div className="lfc-top">
                          <span className={`lfc-status ${live ? 'live' : 'ended'}`}>{live ? '🟢 LIVE' : '⚫ ENDED'}</span>
                          <span className="lfc-slot">Slot {batch.slot}</span>
                          <button type="button" onClick={() => handleRevokeBatch(batch)}
                            title="Revoke link & wipe responses"
                            style={{ marginLeft: 'auto', background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>
                            🚫 Revoke
                          </button>
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

          {/* ═══════════════ NEW POOL PANEL ═══════════════ */}
          <section className="panel pool-panel" style={{ marginTop: '24px' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>👥 Faculty Pool <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px', marginLeft: '8px', color: '#475569' }}>{globalFacultyPool.length} Unassigned</span></h3>
              {globalFacultyPool.length > 0 && (
                <button type="button" onClick={clearFacultyPool} disabled={isSaving} style={{ background: 'white', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  {isSaving ? '⏳...' : '🗑️ Clear Pool'}
                </button>
              )}
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

          {/* ═══════════════ CURRICULUM PANEL ═══════════════ */}
          <section className="panel pool-panel" style={{ marginTop: '24px' }}>
            <div className="panel-header">
              <h3>📚 Subjects in this Semester</h3>
            </div>
            {Object.keys(curriculum).length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <span className="empty-icon">📝</span>
                <p>No subjects defined yet. Click "+ Define Subjects" to set up your curriculum.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', padding: '16px' }}>
                {Object.entries(curriculum).map(([key, data]) => {
                  const [yOrB, sem] = key.split('_');
                  return (
                    <div key={key} style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '15px', color: '#1e293b' }}>
                          {isSH ? `Branch: ${yOrB}` : `Year ${yOrB}`} · Sem {sem}
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
                            {data.sections.length} Sections
                          </span>
                          <button type="button" onClick={() => handleDeleteCurriculum(key)} title="Delete Subjects" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                        <strong>Taught in:</strong> {data.sections.join(', ')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {data.subjects.map(sub => (
                          <span key={sub} style={{ background: 'white', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', border: '1px solid #cbd5e1' }}>
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </main>

        {/* ═══════════════ DEFINE SUBJECTS MODAL ═══════════════ */}
        {showSubjectModal && (
          <div className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
            <div className="modal-content assign-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📚 Define Semester Subjects</h2>
                <div className="step-indicator">
                  {[1,2,3].map(n => (
                    <div key={n} className={`step-dot ${subStep === n ? 'active' : subStep > n ? 'done' : ''}`}>
                      {subStep > n ? '✓' : n}
                    </div>
                  ))}
                </div>
                <p>{subStep === 1 ? 'Select Year & Semester' : subStep === 2 ? 'Add Subjects' : 'Select target sections'}</p>
              </div>
              <div className="modal-body">
                {subStep === 1 && (
                  <div className="assign-step">
                    {isSH ? (
                      <div className="form-field">
                        <label>Branch</label>
                        <select value={subBranch} onChange={e => setSubBranch(e.target.value)}>
                          <option value="">Select Branch</option>
                          {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-field">
                        <label>Year</label>
                        <select value={subYear} onChange={e => setSubYear(e.target.value)}>
                          <option value="">Select Year</option>
                          {availableYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-field">
                      <label>Semester</label>
                      <select value={subSem} onChange={e => setSubSem(e.target.value)}>
                        <option value="">Select Semester</option>
                        {SEMESTERS.map(s => <option key={s} value={s}>Semester {s}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                {subStep === 2 && (
                  <div className="assign-step">
                    <div className="step-context-badge">{isSH ? subBranch : `Year ${subYear}`} · Semester {subSem}</div>
                    <div className="form-field">
                      <label>Number of subjects this semester</label>
                      <input 
                        type="number" min="1" max="12" value={subCount}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '') { setSubCount(''); return; }
                          const n = Math.max(1, Math.min(12, parseInt(val, 10)));
                          setSubCount(n);
                          setSubNames(prev => { const a = [...prev]; while (a.length < n) a.push(''); return a.slice(0, n); });
                        }} 
                        onBlur={() => {
                          if (subCount === '') { setSubCount(1); setSubNames(prev => prev.length ? [prev[0]] : ['']); }
                        }}
                        style={{ width: '100px' }} 
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Array.from({ length: subCount || 1 }, (_, i) => (
                        <div className="form-field" key={i}>
                          <input type="text"
                            placeholder={`Subject ${i + 1} Name`}
                            value={subNames[i] || ''}
                            onChange={e => { const a = [...subNames]; a[i] = e.target.value; setSubNames(a); }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subStep === 3 && (
                  <div className="assign-step">
                    <div className="step-context-badge">{subNames.filter(Boolean).length} Subjects defined</div>
                    <div className="form-field">
                      <label>Which sections take these subjects?</label>
                      <div className="sec-checkbox-list" style={{ marginTop: '10px' }}>
                        {(sectionsByKey[isSH ? subBranch : subYear] || []).map(s => {
                          const checked = subSections.includes(s.sectionName);
                          return (
                            <label key={s.id} className="sec-checkbox-item">
                              <input type="checkbox" checked={checked}
                                onChange={() => setSubSections(prev => checked ? prev.filter(x => x !== s.sectionName) : [...prev, s.sectionName])} />
                              <span>Section {s.sectionName}</span>
                            </label>
                          );
                        })}
                        {(sectionsByKey[isSH ? subBranch : subYear] || []).length === 0 && (
                          <span style={{ fontSize: '13px', color: '#ef4444' }}>No sections found. Add sections from the main menu first.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {subStep === 1 && <><button className="btn-confirm" onClick={handleSubStep1}>Next →</button><button className="btn-modal-cancel" onClick={() => setShowSubjectModal(false)}>Cancel</button></>}
                {subStep === 2 && <><button className="btn-confirm" onClick={handleSubStep2}>Next →</button><button className="btn-modal-cancel" onClick={() => setSubStep(1)}>← Back</button></>}
                {subStep === 3 && <><button className="btn-confirm" onClick={handleSaveSubjects}>✅ Save to Curriculum</button><button className="btn-modal-cancel" onClick={() => setSubStep(2)}>← Back</button></>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ ASSIGN FACULTY MODAL (NEW) ═══════════════ */}
        {showAssignModal && (
          <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
            <div className="modal-content assign-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📌 Assign Faculty to Section</h2>
                <div className="step-indicator">
                  {[1,2,3].map(n => (
                    <div key={n} className={`step-dot ${assignStep === n ? 'active' : assignStep > n ? 'done' : ''}`}>
                      {assignStep > n ? '✓' : n}
                    </div>
                  ))}
                </div>
                <p>{assignStep === 1 ? 'Year & Semester' : assignStep === 2 ? 'Select Section' : 'Assign Faculty'}</p>
              </div>
              <div className="modal-body">
                {assignStep === 1 && (
                  <div className="assign-step">
                    {isSH ? (
                      <div className="form-field">
                        <label>Branch</label>
                        <select value={assignBranch} onChange={e => setAssignBranch(e.target.value)}>
                          <option value="">Select Branch</option>
                          {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-field">
                        <label>Year</label>
                        <select value={assignYear} onChange={e => setAssignYear(e.target.value)}>
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
                    <div className="step-context-badge">{isSH ? assignBranch : `Year ${assignYear}`} · Semester {assignSem}</div>
                    <div className="form-field">
                      <label>Select Section</label>
                      <select value={assignSection} onChange={e => setAssignSection(e.target.value)}>
                        <option value="">— Select Section —</option>
                        {(sectionsByKey[isSH ? assignBranch : assignYear] || []).map(s => (
                          <option key={s.id} value={s.sectionName}>Section {s.sectionName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {assignStep === 3 && (
                  <div className="assign-step">
                    <div className="step-context-badge" style={{ marginBottom: '16px' }}>Section {assignSection} Assignments</div>
                    <table className="publish-faculty-table">
                      <thead>
                        <tr><th style={{ width: '40%' }}>Subject</th><th>Assigned Faculty</th></tr>
                      </thead>
                      <tbody>
                        {Object.keys(assignSelections).map(subject => (
                          <tr key={subject}>
                            <td><strong>{subject}</strong></td>
                            <td>
                              <select 
                                value={assignSelections[subject]} 
                                onChange={e => setAssignSelections(prev => ({...prev, [subject]: e.target.value}))}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                                <option value="">— Select from Pool —</option>
                                {globalFacultyPool.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {assignStep === 1 && <><button className="btn-confirm" onClick={handleAssignStep1}>Next →</button><button className="btn-modal-cancel" onClick={() => setShowAssignModal(false)}>Cancel</button></>}
                {assignStep === 2 && <><button className="btn-confirm" onClick={handleAssignStep2}>Next →</button><button className="btn-modal-cancel" onClick={() => setAssignStep(1)}>← Back</button></>}
                {assignStep === 3 && <><button className="btn-confirm" onClick={handleAssignFaculty} disabled={isAssigning}>{isAssigning ? '⏳ Assigning…' : '✅ Assign to Section'}</button><button className="btn-modal-cancel" onClick={() => setAssignStep(2)}>← Back</button></>}
              </div>
            </div>
          </div>
        )}

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
                                  <button type="button" className="esc-btn esc-save" onClick={async () => { await sectionAPI.update(s.id, { strength: Number(editStrengthVal) }); setSections(prev => prev.map(x => x.id === s.id ? { ...x, strength: Number(editStrengthVal) } : x)); setEditStrengthId(null); loadDashboardData(); }}>✓</button>
                                  <button type="button" className="esc-btn esc-cancel" onClick={() => setEditStrengthId(null)}>✕</button>
                                </>
                              ) : (
                                <span className="esc-strength" title="Click to edit" onClick={() => { setEditStrengthId(s.id); setEditStrengthVal(String(s.strength || 0)); }}>{s.strength || 0}👤</span>
                              )}
                              <button type="button" className="esc-btn esc-delete" onClick={() => showConfirm(`Delete "${s.sectionName}"?`, async () => { await sectionAPI.delete(s.id); setSections(prev => prev.filter(x => x.id !== s.id)); })}>🗑</button>
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
                                // BLAST IN PARALLEL!
                                const createPromises = availableYears.map(yr => 
                                  sectionAPI.create({ year: yr, branch: '', sectionName: name, strength })
                                );
                                const responses = await Promise.all(createPromises);
                                const newSecs = responses.map(res => res.data.section);
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

       {/* ── Link Modal (post-publish) ── */}
        {linkModal.show && (
          <div className="modal-overlay" onClick={() => setLinkModal({ show: false, url: '' })}>
            <div className="modal-content" style={{ maxWidth: '480px', padding: '28px' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px' }}>✅ Feedback Link Published!</h3>
                <button onClick={() => setLinkModal({ show: false, url: '' })} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Share this link with students. It closes on the end date you set.</p>
              <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '12px', fontSize: '13px', wordBreak: 'break-all', color: '#1e293b', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                {linkModal.url}
              </div>
              <button
                onClick={async () => {
                  try { await navigator.clipboard.writeText(linkModal.url); showToast('Link copied!', 'success'); setLinkModal({ show: false, url: '' }); }
                  catch (_) { showToast('Copy failed — select and copy manually.'); }
                }}
                style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                📋 Copy Link & Close
              </button>
            </div>
          </div>
        )}

        {/* ── Generic Confirm Modal ── */}
        {confirmModal.show && (
          <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, message: '', pendingAction: null })}>
            <div className="modal-content" style={{ maxWidth: '400px', padding: '28px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
              <p style={{ fontSize: '14px', color: '#334155', marginBottom: '20px', lineHeight: '1.6' }}>{confirmModal.message}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { confirmModal.pendingAction?.(); setConfirmModal({ show: false, message: '', pendingAction: null }); }}
                  style={{ flex: 1, padding: '10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                  Confirm
                </button>
                <button onClick={() => setConfirmModal({ show: false, message: '', pendingAction: null })}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '2px solid #e2e8f0', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#64748b' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Profile Modal ── */}
        {showProfileModal && (
          <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>✏️ Edit Profile</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>User ID: <strong>{currentUser.userId}</strong></p>
              </div>
              <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '20px' }}>
                {['details', 'password'].map(tab => (
                  <button key={tab} type="button"
                    onClick={() => { setProfileTab(tab); setProfileErr(''); }}
                    style={{ flex: 1, padding: '10px', border: 'none', background: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', borderBottom: profileTab === tab ? '3px solid #7c3aed' : '3px solid transparent', color: profileTab === tab ? '#7c3aed' : '#64748b' }}>
                    {tab === 'details' ? '👤 Personal Details' : '🔒 Change Password'}
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                {profileTab === 'details' ? (
                  <>
                    {[['name', 'Full Name', 'text'], ['email', 'Email', 'email'], ['mobile', 'Mobile', 'tel']].map(([field, label, type]) => (
                      <div className="form-field" key={field} style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</label>
                        <input type={type} value={profileForm[field]}
                          onChange={e => setProfileForm(p => ({ ...p, [field]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }} />
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {[['currentPwd', 'Current Password'], ['newPwd', 'New Password (min 8 chars)'], ['confirmPwd', 'Confirm New Password']].map(([field, label]) => (
                      <div className="form-field" key={field} style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</label>
                        <input type="password" value={profilePwdForm[field]}
                          onChange={e => setProfilePwdForm(p => ({ ...p, [field]: e.target.value }))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', marginTop: '4px' }} />
                      </div>
                    ))}
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '-8px' }}>
                      Don't know your current password?{' '}
                      <span style={{ color: '#7c3aed', cursor: 'pointer', fontWeight: '600' }}
                        onClick={() => { setShowProfileModal(false); showToast('Use "Forgot Password" on the login page to reset.', 'info'); }}>
                        Use Forgot Password on login page.
                      </span>
                    </p>
                  </>
                )}
                {profileErr && <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px', background: '#fef2f2', borderRadius: '6px', marginTop: '8px' }}>⚠️ {profileErr}</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button onClick={profileTab === 'details' ? handleSaveProfile : handleChangePassword}
                    disabled={isSavingProfile}
                    style={{ flex: 1, padding: '10px', background: isSavingProfile ? '#ccc' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: isSavingProfile ? 'not-allowed' : 'pointer' }}>
                    {isSavingProfile ? '⏳ Saving…' : profileTab === 'details' ? '✅ Save Changes' : '🔒 Update Password'}
                  </button>
                  <button onClick={() => setShowProfileModal(false)} className="btn-modal-cancel">Cancel</button>
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
  const groupedRows = groupFacultyRecords(rows);
  return (
    <div className="fac-table-wrap">
      <table className="fac-table">
        <thead>
          <tr>
            <th>Faculty Name</th>
            <th>Subject</th>
            <th>Sem · Sec</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.map(g => {
            // THE FIX: Create an absolutely stable key based on their exact assignment profile
            const stableKey = `${g.name}-${g.subject}-${g.sem}-${g.allSecs.sort().join('')}`;
            
            return (
              <tr key={stableKey} className="fac-tr">
                <td className="ft-name">{g.name}</td>
                <td className="ft-subject">{g.subject || <span className="ft-empty">—</span>}</td>
                <td>
                  <span className="ft-badge">
                    Sem {g.sem} · {g.allSecs.sort().join(' & ')}
                  </span>
                </td>
                <td>
                  <div className="ft-actions">
                    <button type="button" className="fta-btn fta-del" onClick={() => onDelete(g.ids, g.subject)} title="Remove Assignment">🗑</button>
                    <button type="button" className="fta-btn fta-pdf" onClick={() => onPDF(g.records[0])} title="Download PDF">📄</button>
                    <button type="button" className="fta-btn fta-xls" onClick={() => onExcel(g.records[0])} title="Download Excel">📊</button>
                  </div>
                </td>
              </tr>
            );
          })}
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