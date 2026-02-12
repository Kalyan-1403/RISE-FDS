import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/HomePage/HomePage.jsx';
import HoDDashboard from './components/HoDDashboard/HoDDashboard.jsx';
import AdminDashboard from './components/AdminDashboard/AdminDashboard.jsx';
import StudentFeedback from './components/StudentFeedback/StudentFeedback.jsx';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hod/dashboard" element={<HoDDashboard />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/feedback/:batchId" element={<StudentFeedback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
