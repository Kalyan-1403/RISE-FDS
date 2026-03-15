import React, { useState, useEffect, useRef } from 'react';
import Confetti from 'react-confetti';
import dataService from '../../services/dataService.js';
import './CreatePasswordPage.css';

const CreatePasswordPage = ({ userData, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FIX: Real user ID comes from backend API response only
  const [realUserId, setRealUserId] = useState('');

  // Copy-gate: "Go to Login" button stays locked until user copies the ID
  const [hasCopied, setHasCopied] = useState(false);
  const [copied, setCopied] = useState(false);

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect keyboard Ctrl+C / Cmd+C when success screen is showing
  useEffect(() => {
    if (!showSuccess || !realUserId) return;
    const handleKeyDown = (e) => {
      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
      if (isCopy) {
        const selection = window.getSelection()?.toString() || '';
        if (selection.includes(realUserId.trim())) {
          setHasCopied(true);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSuccess, realUserId]);

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
    setPassword(e.target.value);
    setPasswordStrength(calculateStrength(e.target.value));
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

  const handleCopyUserId = () => {
    if (!realUserId) return;
    navigator.clipboard.writeText(realUserId).then(() => {
      setCopied(true);
      setHasCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
      // FIX: No user_id sent — backend generates it securely
      const response = await dataService.register({
        password,
        name: userData.name,
        college: userData.college,
        department: userData.department,
        mobile: userData.mobile,
        email: userData.email,
      });

      // Capture the real backend-generated user ID
      const backendUserId = response?.userId || response?.data?.userId || '';
      setRealUserId(backendUserId);
      setShowConfetti(true);
      setShowSuccess(true);

      // Stop confetti after 4s but keep screen open until user copies
      setTimeout(() => setShowConfetti(false), 4000);
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthData = getStrengthData();

  // ── Success Screen ──────────────────────────────────────────────────────────
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
            {/* Real User ID — prominent display */}
            <div style={{
              background: '#1E3A5F',
              borderRadius: '12px',
              padding: '20px 24px',
              margin: '16px 0',
              textAlign: 'center',
            }}>
              <p style={{ color: '#aac4e0', fontSize: '13px', margin: '0 0 6px 0', fontWeight: 'bold' }}>
                🔑 YOUR USER ID
              </p>

              {/* Selectable text — mouse select+copy also unlocks the button */}
              <p
                onCopy={() => setHasCopied(true)}
                style={{
                  color: '#ffffff',
                  fontSize: '26px',
                  fontWeight: 'bold',
                  letterSpacing: '3px',
                  margin: '0 0 14px 0',
                  fontFamily: 'monospace',
                  userSelect: 'text',
                  cursor: 'text',
                }}
              >
                {realUserId || '...'}
              </p>

              <button
                onClick={handleCopyUserId}
                style={{
                  background: copied ? '#27AE60' : '#2E86C1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? '✅ Copied!' : '📋 Copy User ID'}
              </button>
            </div>

            {/* Status message */}
            {!hasCopied ? (
              <div style={{
                background: '#FFF3CD',
                border: '1px solid #FFC107',
                borderRadius: '8px',
                padding: '10px 16px',
                margin: '8px 0',
                fontSize: '13px',
                color: '#856404',
                fontWeight: 'bold',
              }}>
                ⚠️ Copy your User ID first — you cannot proceed without it
              </div>
            ) : (
              <div style={{
                background: '#D4EDDA',
                border: '1px solid #28A745',
                borderRadius: '8px',
                padding: '10px 16px',
                margin: '8px 0',
                fontSize: '13px',
                color: '#155724',
                fontWeight: 'bold',
              }}>
                ✅ User ID copied — you're good to go!
              </div>
            )}

            {/* Continue button — locked until ID is copied */}
            <button
              onClick={hasCopied ? onClose : undefined}
              disabled={!hasCopied}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: hasCopied ? 'pointer' : 'not-allowed',
                background: hasCopied ? '#1E3A5F' : '#CCCCCC',
                color: hasCopied ? '#FFFFFF' : '#888888',
                transition: 'background 0.3s, color 0.3s',
              }}
            >
              {hasCopied ? '✅ Go to Login →' : '🔒 Copy User ID to Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Password Form ───────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay">
      <div className="modal-content password-page">
        <button className="modal-close-btn" onClick={onClose}>×</button>

        <div className="password-header">
          <div className="header-icon">🔐</div>
          <h2>Create Your Password</h2>
          <div style={{
            background: '#FFF3CD',
            border: '1px solid #FFC107',
            borderRadius: '8px',
            padding: '10px 14px',
            margin: '8px 0',
            fontSize: '13px',
            color: '#856404',
          }}>
            ⚠️ Your User ID will be shown after account creation — you must copy it before continuing
          </div>
        </div>

        <div className="password-form-scroll">
          <form className="password-form" onSubmit={handleSubmit}>
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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

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
                    <div className="strength-character" style={{ color: strengthData.color }}>
                      <div className="character-emoji">{strengthData.emoji}</div>
                      <div className="strength-text">{strengthData.text}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-field">
              <label>
                <span className="field-icon">✅</span>
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Re-enter your password"
                  required
                  disabled={isSubmitting}
                  autoComplete="new-password"
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
