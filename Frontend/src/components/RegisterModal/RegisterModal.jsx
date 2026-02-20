import React, { useState } from 'react';
import './RegisterModal.css';
import CreatePasswordPage from '../CreatePasswordPage/CreatePasswordPage';

const RegisterModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    college: '',
    department: '',
    mobile: '',
    email: ''
  });
  const [errors, setErrors] = useState({});
  const [showPasswordPage, setShowPasswordPage] = useState(false);
  const [generatedUserId, setGeneratedUserId] = useState('');

  const departmentsByCollege = {
    Gandhi: ['S&H', 'CSE', 'ECE'],
    Prakasam: ['S&H', 'CSE', 'ECE', 'EEE', 'CIVIL', 'MECH', 'MBA', 'MCA', 'M.TECH']
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.college) {
      newErrors.college = 'Please select a college';
    }

    if (!formData.department) {
      newErrors.department = 'Please select a department';
    }

    const mobileRegex = /^[6-9]\d{9}$/;
    if (!formData.mobile) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!mobileRegex.test(formData.mobile)) {
      newErrors.mobile = 'Please enter a valid Indian mobile number';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateUserId = () => {
    const deptCode = formData.department;
    const collegeCode = formData.college === 'Gandhi' ? 'G' : 'P';
    const randomNum = Math.floor(Math.random() * 1000) + 1;
    return `${deptCode}-${collegeCode}_${randomNum}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // Check if department already has an HoD registered
      const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      const duplicate = existingUsers.find(
        (u) =>
          u.role === 'hod' &&
          u.college === formData.college &&
          u.department === formData.department
      );

      if (duplicate) {
        alert(
          `🚨 IMPOSTER ALERT!\n\nAn HoD account for ${formData.college} College - ${formData.department} Department already exists!\n\nOnly ONE HoD registration is allowed per department.\n\nIf you believe this is an error, please contact the Master Admin.`
        );
        return;
      }

      const userId = generateUserId();
      setGeneratedUserId(userId);
      setShowPasswordPage(true);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'college') {
      setFormData(prev => ({ ...prev, department: '' }));
    }
  };

  if (showPasswordPage) {
    return (
      <CreatePasswordPage
        userId={generatedUserId}
        userData={formData}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <div className="modal-icon">🎓</div>
          <h2>New User Registration</h2>
          <p>Join RISE Feedback Management System</p>
        </div>

                <div className="modal-body">
          <form className="register-form" onSubmit={handleSubmit}>
            {/* Name */}
            <div className="form-field">
              <label>
                <span className="field-icon">👤</span>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            {/* College */}
            <div className="form-field">
              <label>
                <span className="field-icon">🏫</span>
                College
              </label>
              <select
                name="college"
                value={formData.college}
                onChange={handleChange}
                className={errors.college ? 'error' : ''}
              >
                <option value="">Choose College</option>
                <option value="Gandhi">Gandhi</option>
                <option value="Prakasam">Prakasam</option>
              </select>
              {errors.college && <span className="error-text">{errors.college}</span>}
            </div>

            {/* Department */}
            <div className="form-field">
              <label>
                <span className="field-icon">📖</span>
                Department
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={!formData.college}
                className={errors.department ? 'error' : ''}
              >
                <option value="">Choose Department</option>
                {formData.college && departmentsByCollege[formData.college].map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {errors.department && <span className="error-text">{errors.department}</span>}
            </div>

            {/* Mobile */}
            <div className="form-field">
              <label>
                <span className="field-icon">📱</span>
                Mobile Number
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="Enter 10-digit mobile number"
                maxLength="10"
                className={errors.mobile ? 'error' : ''}
              />
              {errors.mobile && <span className="error-text">{errors.mobile}</span>}
            </div>

            {/* Email */}
            <div className="form-field">
              <label>
                <span className="field-icon">📧</span>
                Email ID
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email address"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <button type="submit" className="submit-btn">
              <span>Submit & Register</span>
              <span className="btn-arrow">→</span>
            </button>
          </form>
	</div>
      </div>
    </div>
  );
};

export default RegisterModal;
