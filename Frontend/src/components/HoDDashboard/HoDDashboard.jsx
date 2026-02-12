import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';
import './HoDDashboard.css';

const YEARS = ['II', 'III', 'IV'];
const SEMESTERS = ['I', 'II'];

const BRANCHES_BY_COLLEGE = {
  Gandhi: ['CSE', 'ECE'],
  Prakasam: ['CSE', 'ECE', 'EEE', 'CIVIL', 'MECH'],
};

const checkStorageSpace = () => {
  try {
    const test = 'storage_test_' + Date.now();
    localStorage.setItem(test, 'test');
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.error('Storage error:', e);
    return false;
  }
};

const HoDDashboard = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedSec, setSelectedSec] = useState('');
  const [facultyList, setFacultyList] = useState([]);
  const [newFaculty, setNewFaculty] = useState({ name: '', subject: '', code: '' });
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFacultyIds, setSelectedFacultyIds] = useState([]);
  const [allBatches, setAllBatches] = useState([]);

const [slotNumber, setSlotNumber] = useState(1); // 1 or 2
const [slotStartDate, setSlotStartDate] = useState('');
const [slotEndDate, setSlotEndDate] = useState('');


  useEffect(() => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'hod') {
    navigate('/');
  } else {
    console.log('👤 Loaded User:', user);
    console.log('🏛️ Department:', user.department);
    
    setCurrentUser(user);
    loadFacultyForDepartment(user.college, user.department);
    loadBatches(user.college, user.department);
  }
}, [navigate]);


  // FIXED: Include college in storage key
  const loadFacultyForDepartment = (college, dept) => {
    try {
      const savedFaculty = localStorage.getItem(`faculty_${college}_${dept}`);
      if (savedFaculty) {
        setFacultyList(JSON.parse(savedFaculty));
      }
    } catch (e) {
      console.error('Failed to load faculty:', e);
      alert('⚠️ Failed to load faculty data. Please refresh the page.');
    }
  };

  const loadBatches = (college, dept) => {
    try {
      const batches = [];
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('batch_')) {
          const batch = JSON.parse(localStorage.getItem(key));
          if (batch.college === college && batch.dept === dept) {
            batches.push(batch);
          }
        }
      });
      batches.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      setAllBatches(batches);
    } catch (e) {
      console.error('Failed to load batches:', e);
    }
  };

  // FIXED: Save with college in key
  const saveFacultyToLocalStorage = (updatedList) => {
    if (!checkStorageSpace()) {
      alert('⚠️ Storage limit reached! Please contact administrator.');
      return false;
    }
    if (currentUser) {
      try {
		const hodKey = `faculty_${currentUser.college}_${currentUser.department}`;
      localStorage.setItem(hodKey, JSON.stringify(updatedList));
      
  // Update master list with college key
        const masterList = JSON.parse(localStorage.getItem('masterFacultyList') || '{}');
        const masterKey = `${currentUser.college}_${currentUser.department}`;
        masterList[masterKey] = updatedList;
        localStorage.setItem('masterFacultyList', JSON.stringify(masterList));

        window.dispatchEvent(new Event('storage'));
        return true;
      } catch (e) {
        console.error('Save error:', e);
        alert('⚠️ Failed to save data: ' + e.message);
        return false;
      }
    }
    return false;
  };

  const isSH = useMemo(() => {
  console.log('🔍 Checking isSH - Dept:', currentUser?.department);
  const result = currentUser?.department === 'S&H';
  console.log('🔍 Is S&H?:', result);
  return result;
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
    return BRANCHES_BY_COLLEGE[currentUser.college] || [];
  }, [currentUser, isSH]);

  const filteredFaculty = useMemo(() => {
    if (isSH) {
      return selectedBranch ? facultyList.filter((f) => f.branch === selectedBranch) : [];
    } else {
      return selectedYear ? facultyList.filter((f) => f.year === selectedYear) : facultyList;
    }
  }, [facultyList, selectedYear, selectedBranch, isSH]);

  const facultyByBranch = useMemo(() => {
    if (!isSH) return {};
    const grouped = {};
    availableBranches.forEach((branch) => {
      grouped[branch] = facultyList.filter((f) => f.branch === branch);
    });
    return grouped;
  }, [facultyList, availableBranches, isSH]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const addOrUpdateFaculty = () => {
  // Trim inputs first
  const trimmedName = newFaculty.name.trim();
  const trimmedSubject = newFaculty.subject.trim();
  const trimmedCode = newFaculty.code.trim();

  // Check if fields are empty
  if (!trimmedName || !trimmedSubject || !trimmedCode) {
    alert('⚠️ Enter Code, Name & Subject');
    return;
  }

  // Validate Name - Only alphabets, spaces, and dots (for Dr., Prof., etc.)
  const nameRegex = /^[A-Za-z\s.]+$/;
  if (!nameRegex.test(trimmedName)) {
    alert('⚠️ Faculty Name must contain only letters and spaces (no numbers or special characters)');
    return;
  }

  // Validate Subject - Only alphabets, spaces, and common punctuation
  const subjectRegex = /^[A-Za-z\s&\-().,]+$/;
  if (!subjectRegex.test(trimmedSubject)) {
    alert('⚠️ Subject must contain only letters, spaces, and basic punctuation (&, -, parentheses)');
    return;
  }

  // Validate Code - Alphanumeric only (letters and numbers)
  const codeRegex = /^[A-Za-z0-9]+$/;
  if (!codeRegex.test(trimmedCode)) {
    alert('⚠️ Subject Code must be alphanumeric (letters and numbers only, no spaces or special characters)');
    return;
  }

  // Check S&H requires branch
  if (isSH) {
    if (!selectedBranch || !selectedSem || !selectedSec) {
      alert('⚠️ Select Branch, Semester & Section first');
      return;
    }
  } else {
    if (!selectedYear || !selectedSem || !selectedSec) {
      alert('⚠️ Select Year, Semester & Section first');
      return;
    }
  }

  const facultyData = {
    id: editingId || Date.now(),
    name: trimmedName,
    subject: trimmedSubject,
    code: trimmedCode.toUpperCase(),
    year: isSH ? 'I' : selectedYear,
    branch: isSH ? selectedBranch : currentUser.department,
    sem: selectedSem,
    sec: selectedSec,
    dept: currentUser.department,
    college: currentUser.college,
    addedDate: new Date().toLocaleDateString(),
  };

  let updatedList;
  if (editingId) {
    updatedList = facultyList.map((f) => (f.id === editingId ? facultyData : f));
    setEditingId(null);
  } else {
    updatedList = [...facultyList, facultyData];
  }

  setFacultyList(updatedList);
  if (saveFacultyToLocalStorage(updatedList)) {
    setNewFaculty({ name: '', subject: '', code: '' });
  }
};


  const editFaculty = (f) => {
    setNewFaculty({ name: f.name, subject: f.subject, code: f.code });
    if (isSH) {
      setSelectedBranch(f.branch);
    } else {
      setSelectedYear(f.year);
    }
    setSelectedSem(f.sem);
    setSelectedSec(f.sec);
    setEditingId(f.id);
  };

  const deleteFaculty = (id) => {
    if (window.confirm('🗑️ Delete this faculty?')) {
      const updatedList = facultyList.filter((f) => f.id !== id);
      setFacultyList(updatedList);
      saveFacultyToLocalStorage(updatedList);
    }
  };

  const openPublishModal = () => {
  if (facultyList.length === 0) {
    alert('⚠️ Add at least one faculty member first.');
    return;
  }

  // Get all unique combinations of year/branch, semester, and section from faculty list
  const combinations = [];
  const seen = new Set();

  facultyList.forEach((f) => {
    const key = isSH 
      ? `${f.branch}_${f.sem}_${f.sec}` 
      : `${f.year}_${f.sem}_${f.sec}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      combinations.push({
        year: f.year,
        branch: f.branch,
        sem: f.sem,
        sec: f.sec,
        key: key
      });
    }
  });

  // If only one combination exists, auto-select it
  if (combinations.length === 1) {
    const combo = combinations[0];
    const relevantFaculty = facultyList.filter((f) => {
      if (isSH) {
        return f.branch === combo.branch && f.sem === combo.sem && f.sec === combo.sec;
      } else {
        return f.year === combo.year && f.sem === combo.sem && f.sec === combo.sec;
      }
    });
    
    setSelectedFacultyIds(relevantFaculty.map((f) => f.id));
    setShowModal(true);
    return;
  }

  // Multiple combinations - let user choose from modal
  // For now, show all faculty and let user select
  setSelectedFacultyIds(facultyList.map((f) => f.id));
  setShowModal(true);
};


  const toggleFacultySelection = (id) => {
    setSelectedFacultyIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const confirmPublish = () => {
    if (selectedFacultyIds.length === 0) {
      alert('⚠️ Select at least one faculty');
      return;
    }

    const selectedFaculty = facultyList.filter((f) => selectedFacultyIds.includes(f.id));
    const targetYear = isSH ? 'I' : selectedYear;
    const targetBranch = isSH ? selectedBranch : currentUser.department

    const batchId = `${currentUser.college}-${currentUser.department}-${targetBranch}-${targetYear}-${selectedSem}-${selectedSec}-${Date.now()}`;
    // Validate slot dates
if (!slotStartDate || !slotEndDate) {
  alert('⚠️ Please select start and end dates for this slot');
  return;
}

if (new Date(slotEndDate) <= new Date(slotStartDate)) {
  alert('⚠️ End date must be after start date');
  return;
}

const batchData = {
  id: batchId,
  college: currentUser.college,
  dept: currentUser.department,
  branch: targetBranch,
  year: targetYear,
  sem: selectedSem,
  sec: selectedSec,
  faculty: selectedFaculty,
  created: new Date().toLocaleDateString(),
  createdTimestamp: Date.now(),
  // Slot information
  slot: slotNumber,
  slotStartDate: slotStartDate,
  slotEndDate: slotEndDate,
  slotLabel: slotNumber === 1 ? 'Previous Feedback Cycle' : 'Latest Feedback Cycle'
};


    try {
      localStorage.setItem(`batch_${batchId}`, JSON.stringify(batchData));

      const masterList = JSON.parse(localStorage.getItem('masterFacultyList') || '{}');
      const masterKey = `${currentUser.college}_${currentUser.department}`;
      if (!masterList[masterKey]) {
        masterList[masterKey] = [];
      }
      selectedFaculty.forEach((fac) => {
        const exists = masterList[masterKey].some(
          (f) => f.code === fac.code && f.name === fac.name
        );
        if (!exists) {
          masterList[masterKey].push(fac);
        }
      });
      localStorage.setItem('masterFacultyList', 	JSON.stringify(masterList));
      window.dispatchEvent(new Event('storage'));

      setAllBatches([batchData, ...allBatches]);

      const fullLink = `${window.location.origin}/feedback/${batchId}`;
      navigator.clipboard.writeText(fullLink);

      const displayInfo = isSH
        ? `Branch ${targetBranch} • Semester ${selectedSem} • Section ${selectedSec}`
        : `Year ${targetYear} • Semester ${selectedSem} • Section ${selectedSec}`;

      alert(
        `✅ Feedback Link Published!\n\n${fullLink}\n\n📋 Link copied to clipboard!\n\n` +
          `Share this link with students of:\n${displayInfo}`
      );

      setShowModal(false);
      setSelectedFacultyIds([]);
// Reset slot configuration
setSlotNumber(1);
setSlotStartDate('');
setSlotEndDate('');

    } catch (e) {
      console.error('Publish error:', e);
      alert('⚠️ Failed to publish link. Please try again.');
    }
  };

  if (!currentUser) {
    return null;
  }

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
              {currentUser.department} • {currentUser.college} College
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-icon">👤</span>
            <span>{currentUser.name}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
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
                      onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                      <option value="">Select</option>
                      {availableBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-field">
                    <label>Year</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">Select</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
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
                    onChange={(e) => setSelectedSem(e.target.value)}
                  >
                    <option value="">Select</option>
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Section</label>
                  <select
                    value={selectedSec}
                    onChange={(e) => setSelectedSec(e.target.value)}
                  >
                    <option value="">Select</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
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
                    setNewFaculty((prev) => ({ ...prev, code: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={newFaculty.name}
                  onChange={(e) =>
                    setNewFaculty((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Subject"
                  value={newFaculty.subject}
                  onChange={(e) =>
                    setNewFaculty((prev) => ({ ...prev, subject: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className={`btn-add ${editingId ? 'btn-update' : ''}`}
                  onClick={addOrUpdateFaculty}
                >
                  {editingId ? 'Update' : 'Add'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => {
                      setEditingId(null);
                      setNewFaculty({ name: '', subject: '', code: '' });
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <div className="divider" />

              <button type="button" className="btn-publish" onClick={openPublishModal}>
                🚀 Publish Feedback Link
              </button>
            </div>
          </section>

          <section className="panel list-panel">
            <div className="panel-header">
              <h3>👥 Faculty List ({facultyList.length})</h3>
            </div>

            {isSH ? (
              <div className="sh-layout">
                <div className="branch-sidebar">
                  <div className="sidebar-header">Branches</div>
                  {availableBranches.map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      className={`branch-btn ${selectedBranch === branch ? 'active' : ''}`}
                      onClick={() => setSelectedBranch(branch)}
                    >
                      <span className="branch-name">{branch}</span>
                      <span className="branch-count">
                        {facultyByBranch[branch]?.length || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="faculty-list">
                  {!selectedBranch && (
                    <div className="empty-state">
                      <span className="empty-icon">📚</span>
                      <p>Select a branch to view faculty</p>
                    </div>
                  )}

                  {selectedBranch && filteredFaculty.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon">🧑‍🏫</span>
                      <p>No faculty added for {selectedBranch} yet</p>
                    </div>
                  )}

                  {selectedBranch &&
                    filteredFaculty.map((f) => (
                      <div key={f.id} className="faculty-card">
                        <div className="faculty-info">
                          <div className="faculty-code">{f.code}</div>
                          <div className="faculty-details">
                            <div className="faculty-name">{f.name}</div>
                            <div className="faculty-subject">{f.subject}</div>
                            <div className="faculty-badge">
                              Year {f.year} • Sem {f.sem} • Sec {f.sec}
                            </div>
                          </div>
                        </div>
                        <div className="faculty-actions">
                          <button
                            type="button"
                            className="btn-icon edit"
                            onClick={() => editFaculty(f)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn-icon delete"
                            onClick={() => deleteFaculty(f.id)}
                          >
                            🗑️
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
                      onClick={() => setSelectedYear(y)}
                    >
                      <span>{y} Year</span>
                      <span className="count">
                        {facultyList.filter((f) => f.year === y).length} faculty
                      </span>
                    </button>
                  ))}
                </div>

                <div className="faculty-list">
                  {selectedYear === '' && facultyList.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon">📂</span>
                      <p>Select a year to view faculty</p>
                    </div>
                  )}

                  {selectedYear !== '' && filteredFaculty.length === 0 && (
                    <div className="empty-state">
                      <span className="empty-icon">🧑‍🏫</span>
                      <p>No faculty added for Year {selectedYear} yet</p>
                    </div>
                  )}

                  {filteredFaculty.map((f) => (
                    <div key={f.id} className="faculty-card">
                      <div className="faculty-info">
                        <div className="faculty-code">{f.code}</div>
                        <div className="faculty-details">
                          <div className="faculty-name">{f.name}</div>
                          <div className="faculty-subject">{f.subject}</div>
                          <div className="faculty-badge">
                            Year {f.year} • Sem {f.sem} • Sec {f.sec}
                          </div>
                        </div>
                      </div>
                      <div className="faculty-actions">
                        <button
                          type="button"
                          className="btn-icon edit"
                          onClick={() => editFaculty(f)}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon delete"
                          onClick={() => deleteFaculty(f.id)}
                        >
                          🗑️
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
  <div className="modal-overlay" onClick={() => setShowModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      
      {/* ========== HEADER ========== */}
      <div className="modal-header">
        <h2>🔗 Publish Feedback Link</h2>
        <p>Configure slot details and select faculty members</p>
      </div>

      {/* ========== BODY (SCROLLABLE) ========== */}
      <div className="modal-body">
        
        {/* Slot Configuration Section */}
        <div style={{
          padding: '16px',
          background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '2px solid #0ea5e9'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '16px', 
            fontWeight: '700', 
            color: '#0c4a6e' 
          }}>
            📅 Slot Configuration
          </h3>
          
          {/* Slot Selection Buttons */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '13px', 
              fontWeight: '700', 
              marginBottom: '8px', 
              color: '#2d3436' 
            }}>
              Select Slot
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setSlotNumber(1)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: slotNumber === 1 ? '2px solid #0ea5e9' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  background: slotNumber === 1 ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)' : '#f8fafc',
                  color: slotNumber === 1 ? 'white' : '#2d3436',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                📋 Slot 1 (Previous)
              </button>
              <button
                type="button"
                onClick={() => setSlotNumber(2)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: slotNumber === 2 ? '2px solid #0ea5e9' : '2px solid #e2e8f0',
                  borderRadius: '10px',
                  background: slotNumber === 2 ? 'linear-gradient(135deg, #0ea5e9, #06b6d4)' : '#f8fafc',
                  color: slotNumber === 2 ? 'white' : '#2d3436',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                📋 Slot 2 (Latest)
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                fontWeight: '700', 
                marginBottom: '6px', 
                color: '#2d3436' 
              }}>
                Start Date
              </label>
              <input
                type="date"
                value={slotStartDate}
                onChange={(e) => setSlotStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                required
              />
            </div>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '13px', 
                fontWeight: '700', 
                marginBottom: '6px', 
                color: '#2d3436' 
              }}>
                End Date
              </label>
              <input
                type="date"
                value={slotEndDate}
                onChange={(e) => setSlotEndDate(e.target.value)}
                min={slotStartDate}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                required
              />
            </div>
          </div>
          
          {/* Date Range Info */}
          {slotStartDate && slotEndDate && (
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(14, 165, 233, 0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#0369a1'
            }}>
              ℹ️ This slot will be active from {new Date(slotStartDate).toLocaleDateString()} to {new Date(slotEndDate).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Faculty Selection Section */}
        <div style={{
          padding: '16px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '2px solid #e2e8f0'
        }}>
          <div className="section-header">
            <h3>👥 Select Faculty Members</h3>
            <p>{selectedFacultyIds.length} of {facultyList.length} selected</p>
          </div>
          
          {/* Faculty Checkboxes */}
          {facultyList.map((faculty) => (
            <div key={faculty.id} className="checkbox-card">
              <input
                type="checkbox"
                checked={selectedFacultyIds.includes(faculty.id)}
                onChange={() => toggleFacultySelection(faculty.id)}
              />
              <div className="checkbox-content">
                <span className="checkbox-code">{faculty.code}</span>
                <div>
                  <div className="checkbox-name">{faculty.name}</div>
                  <div className="checkbox-subject">{faculty.subject}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* ========== FOOTER ========== */}
      <div className="modal-footer">
        <button className="btn-confirm" onClick={confirmPublish}>
          ✅ Confirm & Publish
        </button>
        <button className="btn-modal-cancel" onClick={() => setShowModal(false)}>
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
