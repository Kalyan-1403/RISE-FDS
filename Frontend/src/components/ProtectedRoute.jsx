import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({
  children,
  requiredRole,
}) => {
  const {
    user,
    isAuthenticated,
    loading,
  } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <p>Verifying authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location }}
      />
    );
  }

  if (
    requiredRole &&
    user.role !== requiredRole
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;