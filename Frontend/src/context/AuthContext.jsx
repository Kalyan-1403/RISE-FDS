import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        const token = localStorage.getItem(
          'access_token'
        );

        if (!savedUser || !token) {
          setLoading(false);
          return;
        }

        // Try to verify with backend
        try {
          const response = await authAPI.me();
          if (
            response.data &&
            response.data.user
          ) {
            const verifiedUser = response.data.user;
            localStorage.setItem(
              'user',
              JSON.stringify(verifiedUser),
            );
            setUser(verifiedUser);
          }
        } catch (apiError) {
          // IMPORTANT: Only clear tokens on
          // explicit 401 (invalid/expired token).
          // Do NOT clear on network errors,
          // timeouts, or CORS issues.
          if (
            apiError.response &&
            apiError.response.status === 401
          ) {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            setLoading(false);
            return;
          }

          // Network error or backend down:
          // Trust the cached user, don't logout
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
        }
      } catch (e) {
        // JSON parse error on savedUser
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const loginUser = useCallback(
    (userData, accessToken, refreshToken) => {
      localStorage.setItem(
        'user',
        JSON.stringify(userData),
      );
      if (accessToken) {
        localStorage.setItem(
          'access_token',
          accessToken,
        );
      }
      if (refreshToken) {
        localStorage.setItem(
          'refresh_token',
          refreshToken,
        );
      }
      setUser(userData);
    },
    [],
  );

  const logoutUser = useCallback(() => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  const isAuthenticated =
    !!user &&
    !!localStorage.getItem('access_token');

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
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loginUser,
        logoutUser,
        loading,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }
  return context;
};

export default AuthContext;