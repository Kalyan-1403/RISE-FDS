import { authAPI } from '../../services/api';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import RegisterModal from '../RegisterModal/RegisterModal.jsx';
import ForgotPasswordModal from '../ForgotPasswordModal/ForgotPasswordModal.jsx';
import DeveloperCredit from '../DeveloperCredit/DeveloperCredit.jsx';

const departmentsByCollege = {
  Gandhi: ['S&H', 'CSE', 'ECE'],
  Prakasam: ['S&H', 'CSE', 'ECE', 'EEE', 'CIVIL', 'MECH', 'MBA', 'MCA', 'M.TECH']
};

// Demo credentials
const DEMO_ADMIN = {
  userId: 'ADMIN_MASTER',
  password: 'admin@123',
  name: 'Master Admin',
};

const DEMO_HODS = [
  { college: 'Gandhi', dept: 'CSE', userId: 'CSE-G_HOD', password: 'hod@123', name: 'Gandhi CSE HoD' },
  { college: 'Gandhi', dept: 'ECE', userId: 'ECE-G_HOD', password: 'hod@123', name: 'Gandhi ECE HoD' },
  { college: 'Gandhi', dept: 'S&H', userId: 'SH-G_HOD', password: 'hod@123', name: 'Gandhi S&H HoD' },

  { college: 'Prakasam', dept: 'S&H', userId: 'SH-P_HOD', password: 'hod@123', name: 'Prakasam S&H HoD' },
  { college: 'Prakasam', dept: 'CSE', userId: 'CSE-P_HOD', password: 'hod@123', name: 'Prakasam CSE HoD' },
  { college: 'Prakasam', dept: 'ECE', userId: 'ECE-P_HOD', password: 'hod@123', name: 'Prakasam ECE HoD' },
  { college: 'Prakasam', dept: 'EEE', userId: 'EEE-P_HOD', password: 'hod@123', name: 'Prakasam EEE HoD' },
  { college: 'Prakasam', dept: 'CIVIL', userId: 'CIVIL-P_HOD', password: 'hod@123', name: 'Prakasam CIVIL HoD' },
  { college: 'Prakasam', dept: 'MECH', userId: 'MECH-P_HOD', password: 'hod@123', name: 'Prakasam MECH HoD' },
  { college: 'Prakasam', dept: 'MBA', userId: 'MBA-P_HOD', password: 'hod@123', name: 'Prakasam MBA HoD' },
  { college: 'Prakasam', dept: 'MCA', userId: 'MCA-P_HOD', password: 'hod@123', name: 'Prakasam MCA HoD' },
  { college: 'Prakasam', dept: 'M.TECH', userId: 'MTECH-P_HOD', password: 'hod@123', name: 'Prakasam M.TECH HoD' },
];

const HomePage = () => {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState('hod');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCollegeChange = (e) => {
    setSelectedCollege(e.target.value);
    setSelectedDepartment('');
    setError('');
  };

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
    setError('');
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setSelectedCollege('');
    setSelectedDepartment('');
    setUserId('');
    setPassword('');
    setError('');
  };

  const handleBack = () => {
    setSelectedCollege('');
    setSelectedDepartment('');
    setUserId('');
    setPassword('');
    setError('');
  };

  const handleLogin = async (e) => {
  e.preventDefault();
  setError('');

  if (!userId.trim()) {
    setError('Please enter your User ID');
    return;
  }
  if (!password) {
    setError('Please enter your password');
    return;
  }

  setIsLoading(true);

  try {
    // Prepare login data
    const loginData = {
      user_id: userId.trim(),
      password: password,
      role: selectedRole,
    };

    // Add college and department for HoD login
    if (selectedRole === 'hod') {
      if (!selectedCollege || !selectedDepartment) {
        setError('Please select college and department');
        setIsLoading(false);
        return;
      }
      loginData.college = selectedCollege;
      loginData.department = selectedDepartment;
    }

    // Call backend API
    const response = await authAPI.login(loginData);

    if (response.data.success) {
      // Store token
      localStorage.setItem('access_token', response.data.access_token);
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Navigate based on role
      if (response.data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/hod/dashboard');
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    if (error.response) {
      setError(error.response.data.error || 'Login failed');
    } else {
      setError('Network error. Please check if backend is running.');
    }
  } finally {
    setIsLoading(false);
  }
};
  const showCollegeDepartment =
    selectedRole === 'hod' && (!selectedCollege || !selectedDepartment);

  const showCredentials =
    selectedRole === 'admin' ||
    (selectedRole === 'hod' && selectedCollege && selectedDepartment);

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
            className={`role-btn ${selectedRole === 'hod' ? 'active' : ''}`}
            onClick={() => handleRoleChange('hod')}
          >
            <div className="role-icon">📚</div>
            <span>HoD</span>
          </button>
          <button
            className={`role-btn ${selectedRole === 'admin' ? 'active' : ''}`}
            onClick={() => handleRoleChange('admin')}
          >
            <div className="role-icon">⚙️</div>
            <span>Admin</span>
          </button>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          {showCollegeDepartment && (
            <>
              <div className="input-group">
                <label>
                  <span className="label-icon">🏫</span>
                  Select College
                </label>
                <select
                  value={selectedCollege}
                  onChange={handleCollegeChange}
                  required
                  className="college-select"
                >
                  <option value="">Choose College</option>
                  <option value="Gandhi">Gandhi</option>
                  <option value="Prakasam">Prakasam</option>
                </select>
              </div>

              <div className="input-group">
                <label>
                  <span className="label-icon">📖</span>
                  Select Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={handleDepartmentChange}
                  required
                  disabled={!selectedCollege}
                  className="department-select"
                >
                  <option value="">Choose Department</option>
                  {selectedCollege &&
                    departmentsByCollege[selectedCollege].map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          {selectedRole === 'hod' && selectedCollege && selectedDepartment && (
            <div className="selection-info">
              <div className="info-row">
                <span className="info-label">🏫 College:</span>
                <span className="info-value">{selectedCollege}</span>
              </div>
              <div className="info-row">
                <span className="info-label">📖 Department:</span>
                <span className="info-value">{selectedDepartment}</span>
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

          {showCredentials && (
            <>
              <div className="input-group">
                <label>
                  <span className="label-icon">👤</span>
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
                  required
                />
              </div>

              <div className="input-group">
                <label>
                  <span className="label-icon">🔒</span>
                  Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="eye-toggle-login"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="error-alert">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {showCredentials && (
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
          )}
        </form>

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
        </div>
      </div>

      <DeveloperCredit />

      {showRegisterModal && (
        <RegisterModal onClose={() => setShowRegisterModal(false)} />
      )}
      {showForgotModal && (
        <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
      )}
    </div>
  );
};

export default HomePage;
