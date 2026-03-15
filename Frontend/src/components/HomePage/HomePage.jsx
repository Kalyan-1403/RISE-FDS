import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService.js';
import './HomePage.css';
import RegisterModal from '../RegisterModal/RegisterModal.jsx';
import ForgotPasswordModal from '../ForgotPasswordModal/ForgotPasswordModal.jsx';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';

const departmentsByCollege = {
  Gandhi: ['S&H', 'CSE', 'ECE'],
  Prakasam: [
    'S&H', 'CSE', 'ECE', 'EEE',
    'CIVIL', 'MECH', 'MBA', 'MCA', 'M.TECH',
  ],
};

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loginUser } = useAuth();

  const [selectedRole, setSelectedRole] = useState('hod');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [collegeConfirmed, setCollegeConfirmed] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
const [showAdminRegModal, setShowAdminRegModal] = useState(false);
  const [adminRegForm, setAdminRegForm] = useState({ name: '', email: '', mobile: '', password: '', admin_role: 'principal', reg_key: '' });
  const [adminRegError, setAdminRegError] = useState('');
  const [adminRegSuccess, setAdminRegSuccess] = useState('');
  const [isAdminRegistering, setIsAdminRegistering] = useState(false);

  // If already logged in, redirect to dashboard
  if (isAuthenticated && user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user.role === 'hod') {
      return <Navigate to="/hod/dashboard" replace />;
    }
  }

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment('');
    setCollegeConfirmed(false);
    setError('');
  };

  const handleDepartmentChange = (e) => {
    const dept = e.target.value;
    setSelectedDepartment(dept);
    setError('');
    if (dept && selectedCollege) {
      setCollegeConfirmed(true);
    }
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setSelectedCollege('');
    setSelectedDepartment('');
    setCollegeConfirmed(false);
    setUserId('');
    setPassword('');
    setError('');
  };

  const handleBack = () => {
    setCollegeConfirmed(false);
    setSelectedCollege('');
    setSelectedDepartment('');
    setUserId('');
    setPassword('');
    setError('');
  };

const handleAdminRegister = async (e) => {
    e.preventDefault();
    setAdminRegError('');
    setAdminRegSuccess('');
    if (!adminRegForm.name || !adminRegForm.email || !adminRegForm.mobile || !adminRegForm.password || !adminRegForm.reg_key) {
      setAdminRegError('All fields are required');
      return;
    }
    setIsAdminRegistering(true);
    try {
      const result = await dataService.registerAdmin(adminRegForm);
      setAdminRegSuccess(`✅ ${result.message} Your User ID is: ${result.userId}`);
      setAdminRegForm({ name: '', email: '', mobile: '', password: '', admin_role: 'principal', reg_key: '' });
    } catch (err) {
      setAdminRegError(err.message || 'Registration failed');
    } finally {
      setIsAdminRegistering(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError('');

    if (!userId.trim()) {
      setError('Please enter your User ID');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (selectedRole === 'hod') {
      if (!selectedCollege || !selectedDepartment) {
        setError(
          'Please select college and department'
        );
        return;
      }
    }

    setIsLoading(true);

    try {
      const loginData = {
        user_id: userId.trim(),
        password: password,
        role: selectedRole,
      };

      if (selectedRole === 'hod') {
        loginData.college = selectedCollege;
        loginData.department = selectedDepartment;
      }

      const result = await dataService.login(loginData);

      if (result && result.success) {
        // Update AuthContext state so React
        // re-renders without needing hard refresh
        loginUser(
          result.user,
          result.access_token,
          result.refresh_token,
        );

        if (result.user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else if (result.user.role === 'hod') {
          navigate('/hod/dashboard', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(
          'Login failed. Please check your credentials.'
        );
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.message) {
        setError(err.message);
      } else {
        setError(
          'Login failed. Please check your credentials.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const needsCollegeSelection =
    selectedRole === 'hod' && !collegeConfirmed;
  const showCredentials =
    selectedRole === 'admin' ||
    (selectedRole === 'hod' && collegeConfirmed);

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="college-logo">
            <div className="logo-circle">
              <span>RISE</span>
            </div>
          </div>
          <h1>Feedback Management System</h1>
          <p className="college-subtitle">
            RISE Krishna Sai Prakasam Group of Institutions
          </p>
        </div>

        <div className="role-selector">
          <button
            type="button"
            className={`role-btn ${
              selectedRole === 'hod' ? 'active' : ''
            }`}
            onClick={() => handleRoleChange('hod')}
          >
            <div className="role-icon">📚</div>
            <span>HoD</span>
          </button>
          <button
            type="button"
            className={`role-btn ${
              selectedRole === 'admin' ? 'active' : ''
            }`}
            onClick={() => handleRoleChange('admin')}
          >
            <div className="role-icon">⚙️</div>
            <span>Admin</span>
          </button>
        </div>

        {needsCollegeSelection && (
          <div className="login-form">
            <div className="input-group">
              <label>
                <span className="label-icon">
                  🏫
                </span>
                Select College
              </label>
              <select
                value={selectedCollege}
                onChange={handleCollegeChange}
                className="college-select"
              >
                <option value="">
                  Choose College
                </option>
                <option value="Gandhi">
                  Gandhi
                </option>
                <option value="Prakasam">
                  Prakasam
                </option>
              </select>
            </div>

            <div className="input-group">
              <label>
                <span className="label-icon">
                  📖
                </span>
                Select Department
              </label>
              <select
                value={selectedDepartment}
                onChange={handleDepartmentChange}
                disabled={!selectedCollege}
                className="department-select"
              >
                <option value="">
                  Choose Department
                </option>
                {selectedCollege &&
                  departmentsByCollege[
                    selectedCollege
                  ].map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {showCredentials && (
          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            {selectedRole === 'hod' && (
              <div className="selection-info">
                <div className="info-row">
                  <span className="info-label">
                    🏫 College:
                  </span>
                  <span className="info-value">
                    {selectedCollege}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">
                    📖 Department:
                  </span>
                  <span className="info-value">
                    {selectedDepartment}
                  </span>
                </div>
                <button
                  type="button"
                  className="change-btn"
                  onClick={handleBack}
                >
                  Change
                </button>
              </div>
            )}

            <div className="input-group">
              <label>
                <span className="label-icon">
                  👤
                </span>
                User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError('');
                }}
                placeholder="Enter your User ID"
              />
            </div>

            <div className="input-group">
              <label>
                <span className="label-icon">
                  🔒
                </span>
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={
                    showPassword ? 'text' : 'password'
                  }
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="eye-toggle-login"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-alert">
                <span className="error-icon">
                  ⚠️
                </span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <span className="arrow">→</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="login-footer">
          <p className="footer-text">
            <span>New user? </span>
            <button
              type="button"
              className="link-btn register-link"
              onClick={() => setShowRegisterModal(true)}
            >
              Register
            </button>
            <span> • </span>
            <button
              type="button"
              className="link-btn forgot-link"
              onClick={() => setShowForgotModal(true)}
            >
              Forgot Password?
            </button>
          </p>
          <p style={{ marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => { setAdminRegError(''); setAdminRegSuccess(''); setShowAdminRegModal(true); }}
              style={{ background: 'none', border: 'none', color: '#ccc', fontSize: '11px', cursor: 'pointer', opacity: 0.4 }}
            >
              ⚙ Management Registration
            </button>
          </p>
        </div>
      </div>

      <DeveloperCredit />
{showAdminRegModal && (
        <div className="modal-overlay" onClick={() => setShowAdminRegModal(false)}>
          <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <button className="modal-close-btn" onClick={() => setShowAdminRegModal(false)}>×</button>
            <div className="modal-header">
              <div className="modal-icon">🔐</div>
              <h2>Management Registration</h2>
              <p>Principal / Director / Chairman</p>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAdminRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-field">
                  <label>Role</label>
                  <select value={adminRegForm.admin_role} onChange={(e) => setAdminRegForm(p => ({ ...p, admin_role: e.target.value }))}>
                    <option value="principal">Principal</option>
                    <option value="director">Director</option>
                    <option value="chairman">Chairman</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Full Name</label>
                  <input type="text" placeholder="Full name" value={adminRegForm.name} onChange={(e) => setAdminRegForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Email</label>
                  <input type="email" placeholder="Email address" value={adminRegForm.email} onChange={(e) => setAdminRegForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Mobile</label>
                  <input type="tel" placeholder="10-digit mobile number" maxLength="10" value={adminRegForm.mobile} onChange={(e) => setAdminRegForm(p => ({ ...p, mobile: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Password</label>
                  <input type="password" placeholder="Create a strong password" value={adminRegForm.password} onChange={(e) => setAdminRegForm(p => ({ ...p, password: e.target.value }))} autoComplete="new-password" />
                </div>
                <div className="form-field">
                  <label>Registration Key</label>
                  <input type="password" placeholder="Secret registration key" value={adminRegForm.reg_key} onChange={(e) => setAdminRegForm(p => ({ ...p, reg_key: e.target.value }))} autoComplete="off" />
                </div>
                {adminRegError && <div className="error-alert"><span>⚠️ {adminRegError}</span></div>}
                {adminRegSuccess && (
                  <div style={{ background: '#D4EDDA', border: '1px solid #28A745', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#155724', fontWeight: 'bold' }}>
                    {adminRegSuccess}
                    <p style={{ marginTop: '6px', fontSize: '12px' }}>⚠️ Save the User ID shown above — it is needed to log in.</p>
                  </div>
                )}
                <button type="submit" className="submit-btn" disabled={isAdminRegistering}>
                  {isAdminRegistering ? 'Registering...' : 'Register Management Account →'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <RegisterModal
          onClose={() =>
            setShowRegisterModal(false)
          }
        />
      )}
      {showForgotModal && (
        <ForgotPasswordModal
          onClose={() =>
            setShowForgotModal(false)
          }
        />
      )}
    </div>
  );
};

export default HomePage;