import React, { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import dataService from '../../services/dataService.js';
import './CreatePasswordPage.css';

const CreatePasswordPage = ({ userId, userData, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateStrength = (pass) => {
    let strength = 0;
    if (pass.length >= 8) strength += 25;
    if (pass.match(/[a-z]+/)) strength += 25;
    if (pass.match(/[A-Z]+/)) strength += 25;
    if (pass.match(/[0-9]+/)) strength += 12.5;
    if (pass.match(/[$@#&!]+/)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(calculateStrength(newPassword));
    setError('');
  };

  const getStrengthData = () => {
    if (passwordStrength < 25)
      return { level: 'weak', emoji: '😰', color: '#e74c3c', text: 'Too Weak!' };
    if (passwordStrength < 50)
      return { level: 'fair', emoji: '😐', color: '#f39c12', text: 'Fair' };
    if (passwordStrength < 75)
      return { level: 'good', emoji: '😊', color: '#3498db', text: 'Good' };
    return { level: 'strong', emoji: '🦸', color: '#2ecc71', text: 'Super Strong!' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 50) {
      setError('Please choose a stronger password');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Register on the backend (PostgreSQL)
      await dataService.register({
        user_id: userId,
        password: password,
        name: userData.name,
        college: userData.college,
        department: userData.department,
        mobile: userData.mobile,
        email: userData.email,
      });

      // Show success animation
      setShowConfetti(true);
      setShowSuccess(true);

      // Redirect to home page after 4 seconds
      setTimeout(() => {
        setShowConfetti(false);
        setTimeout(() => {
          onClose();
        }, 500);
      }, 4000);
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthData = getStrengthData();

  if (showSuccess) {
    return (
      <div className="success-overlay">
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={500}
          />
        )}
        <div className="success-card">
          <div className="success-icon">🎉</div>
          <h2>Account Created Successfully!</h2>
          <p>Welcome to RISE Feedback Management System</p>
          <div className="success-details">
            <p>
              <strong>Your User ID:</strong> {userId}
            </p>
            <p className="redirect-text">Redirecting to login page...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content password-page">
        <button className="modal-close-btn" onClick={onClose}>
          ×
        </button>

        <div className="password-header">
          <div className="header-icon">🔐</div>
          <h2>Create Your Password</h2>
          <div className="user-id-display">
            <span className="user-id-label">Your User ID:</span>
            <span className="user-id-value">{userId}</span>
          </div>
          <p className="save-notice">⚠️ Please save this User ID for future logins</p>
        </div>

        <div className="password-form-scroll">
          <form className="password-form" onSubmit={handleSubmit}>
            {/* Password Field */}
            <div className="form-field">
              <label>
                <span className="field-icon">🔒</span>
                Enter Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Create a strong password"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              {/* Strength Meter */}
              {password && (
                <div className="strength-meter">
                  <div className="strength-bar-container">
                    <div
                      className={`strength-bar ${strengthData.level}`}
                      style={{
                        width: `${passwordStrength}%`,
                        backgroundColor: strengthData.color,
                      }}
                    />
                  </div>
                  <div className="strength-indicator">
                    <div
                      className="strength-character"
                      style={{ color: strengthData.color }}
                    >
                      <div className="character-emoji">{strengthData.emoji}</div>
                      <div className="strength-text">{strengthData.text}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="form-field">
              <label>
                <span className="field-icon">✅</span>
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Re-enter your password"
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button type="submit" className="create-account-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <span className="btn-arrow">✨</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePasswordPage;