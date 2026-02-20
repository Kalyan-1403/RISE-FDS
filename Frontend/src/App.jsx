import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './components/HomePage/HomePage';
import HoDDashboard from './components/HoDDashboard/HoDDashboard';
import AdminDashboard from './components/AdminDashboard/AdminDashboard';
import StudentFeedback from './components/StudentFeedback/StudentFeedback';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<HomePage />} />
          <Route path="/feedback/:batchId" element={<StudentFeedback />} />

          <Route
            path="/hod/dashboard"
            element={
              <ProtectedRoute requiredRole="hod">
                <HoDDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;