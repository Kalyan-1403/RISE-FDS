import React, { useState } from 'react';
import './ForgotPasswordModal.css';

const ForgotPasswordModal = ({ onClose }) => {
  const [step, setStep] = useState(1); // 1: userId, 2: email/mobile/otp, 3: new password
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [error, setError] = useState('');
  const [userVerified, setUserVerified] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const calculateStrength = (pass) => {
    let strength = 0;
    if (pass.length >= 8) strength += 25;
    if (pass.match(/[a-z]+/)) strength += 25;
    if (pass.match(/[A-Z]+/)) strength += 25;
    if (pass.match(/[0-9]+/)) strength += 12.5;
    if (pass.match(/[$@#&!]+/)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const getStrengthData = () => {
    if (passwordStrength < 25) return { level: 'weak', emoji: '😰', color: '#e74c3c', text: 'Too Weak!' };
    if (passwordStrength < 50) return { level: 'fair', emoji: '😐', color: '#f39c12', text: 'Fair' };
    if (passwordStrength < 75) return { level: 'good', emoji: '😊', color: '#3498db', text: 'Good' };
    return { level: 'strong', emoji: '🦸', color: '#2ecc71', text: 'Super Strong!' };
  };

  const handleVerifyUserId = (e) => {
    e.preventDefault();
    
    // Simulate user verification (replace with API call)
    if (userId.trim()) {
      setUserVerified(true);
      setStep(2);
      setError('');
    } else {
      setError('Please enter a valid User ID');
    }
  };

  const handleSendOtp = (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^[6-9]\d{9}$/;

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!mobileRegex.test(mobile)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    // Generate random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setSentOtp(generatedOtp);
    
    // In production, send OTP via API
    console.log('OTP sent:', generatedOtp);
    alert(`OTP sent to email and mobile: ${generatedOtp}`);
    setError('');
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();

    if (otp === sentOtp) {
      setStep(3);
      setError('');
    } else {
      setError('Invalid OTP. Please try again.');
    }
  };

  const handlePasswordChange = (e) => {
    const newPass = e.target.value;
    setNewPassword(newPass);
    setPasswordStrength(calculateStrength(newPass));
    setError('');
  };

  const handleResetPassword = (e) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength < 50) {
      setError('Please choose a stronger password');
      return;
    }

    // Show success message
    setShowSuccess(true);

    // Redirect to home page after 2 seconds
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const strengthData = getStrengthData();

  if (showSuccess) {
    return (
      <div className="modal-overlay">
        <div className="modal-content success-content">
          <div className="success-animation">✅</div>
          <h2>Password Reset Successful!</h2>
          <p>You can now login with your new password</p>
          <p className="redirect-info">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content forgot-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>

        <div className="modal-header">
          <div className="modal-icon">🔑</div>
          <h2>Forgot Password</h2>
          <p>Reset your account password</p>
        </div>

        {/* Step 1: User ID Verification */}
        {step === 1 && (
          <form className="forgot-form" onSubmit={handleVerifyUserId}>
            <div className="step-indicator">
              <span className="step active">1</span>
              <span className="step">2</span>
              <span className="step">3</span>
            </div>

            <div className="form-field">
              <label>
                <span className="field-icon">👤</span>
                Enter Your User ID
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError('');
                }}
                placeholder="e.g., CSE-G_123"
                required
              />
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn">
              <span>Verify User ID</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>
        )}

        {/* Step 2: Email, Mobile & OTP Verification */}
        {step === 2 && (
          <form className="forgot-form" onSubmit={sentOtp ? handleVerifyOtp : handleSendOtp}>
            <div className="step-indicator">
              <span className="step completed">✓</span>
              <span className="step active">2</span>
              <span className="step">3</span>
            </div>

            <div className="form-field">
              <label>
                <span className="field-icon">📧</span>
                Registered Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Enter registered email"
                required
                disabled={sentOtp !== ''}
              />
            </div>

            <div className="form-field">
              <label>
                <span className="field-icon">📱</span>
                Registered Mobile
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setError('');
                }}
                placeholder="Enter registered mobile"
                maxLength="10"
                required
                disabled={sentOtp !== ''}
              />
            </div>

            {!sentOtp && (
              <button type="submit" className="submit-btn">
                <span>Send OTP</span>
                <span className="btn-arrow">📨</span>
              </button>
            )}

            {sentOtp && (
              <>
                <div className="form-field">
                  <label>
                    <span className="field-icon">🔐</span>
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    required
                  />
                  <p className="otp-info">OTP sent to your email and mobile</p>
                </div>

                <button type="submit" className="submit-btn">
                  <span>Verify OTP</span>
                  <span className="btn-arrow">→</span>
                </button>
              </>
            )}

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}
          </form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <form className="forgot-form" onSubmit={handleResetPassword}>
            <div className="step-indicator">
              <span className="step completed">✓</span>
              <span className="step completed">✓</span>
              <span className="step active">3</span>
            </div>

            <div className="form-field">
              <label>
                <span className="field-icon">🔒</span>
                New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>

              {newPassword && (
                <div className="strength-meter">
                  <div className="strength-bar-container">
                    <div 
                      className={`strength-bar ${strengthData.level}`}
                      style={{ 
                        width: `${passwordStrength}%`,
                        backgroundColor: strengthData.color
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

            <div className="form-field">
              <label>
                <span className="field-icon">✅</span>
                Confirm New Password
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Re-enter new password"
                  required
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

            <button type="submit" className="submit-btn">
              <span>Reset Password</span>
              <span className="btn-arrow">✨</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
