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
        } else {
          navigate('/hod/dashboard', { replace: true });
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
              onClick={() =>
                setShowRegisterModal(true)
              }
            >
              Register
            </button>
            <span> • </span>
            <button
              type="button"
              className="link-btn forgot-link"
              onClick={() =>
                setShowForgotModal(true)
              }
            >
              Forgot Password?
            </button>
          </p>
        </div>
      </div>

      <DeveloperCredit />

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