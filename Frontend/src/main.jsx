import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Seed default admin account if no admin exists
const existingUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
const adminExists = existingUsers.some((u) => u.role === 'admin');
if (!adminExists) {
  const defaultAdmin = {
    userId: 'ADMIN',
    password: 'admin@123',
    name: 'Master Admin',
    role: 'admin',
    college: '',
    department: '',
    mobile: '',
    email: 'admin@rise.edu',
    createdAt: new Date().toISOString(),
  };
  existingUsers.push(defaultAdmin);
  localStorage.setItem('registeredUsers', JSON.stringify(existingUsers));
  console.log('🔐 Default admin account created: ADMIN / admin@123');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);