import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { authAPI, setAccessToken, clearAccessToken } from '../services/api';

const AuthContext = createContext(null);

// ─── Non-sensitive user profile cache ────────────────────────────────────────
// We cache the user object (name, role, department etc.) in localStorage so the
// UI can show the correct dashboard immediately on page load before the silent
// refresh completes. This is NOT a secret — it contains no tokens, no passwords.
const USER_CACHE_KEY = 'user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Silent session restore on page load ──────────────────────────────────
  // FIX (CRITICAL): We no longer read tokens from localStorage.
  // Instead, we call /auth/refresh which uses the httpOnly refresh cookie
  // (sent automatically by the browser). If the cookie is valid, we receive
  // a fresh access token and store it in module memory only.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Attempt to get a new access token via the refresh cookie
        const { data } = await authAPI.refresh();
        const newAccessToken = data.access_token;

        if (!newAccessToken) {
          throw new Error('No access token in refresh response');
        }

        // Store access token in memory (api.js module scope)
        setAccessToken(newAccessToken);

        // Verify with backend and get fresh user data
        try {
          const meResponse = await authAPI.me();
          if (meResponse.data?.user) {
            const verifiedUser = meResponse.data.user;
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(verifiedUser));
            setUser(verifiedUser);
          }
        } catch {
          // Refresh worked but /me failed — use cached profile if available
          const cached = localStorage.getItem(USER_CACHE_KEY);
          if (cached) {
            try { setUser(JSON.parse(cached)); } catch { /* ignore parse error */ }
          }
        }
      } catch {
        // Refresh failed — no valid session (cookie expired or missing)
        clearAccessToken();
        localStorage.removeItem(USER_CACHE_KEY);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  // Called by HomePage after a successful login API response.
  // Stores the access token in memory and caches non-sensitive user data.
  const loginUser = useCallback((userData, accessToken) => {
    // FIX (CRITICAL): Access token goes into module memory only.
    // Refresh token was already set as an httpOnly cookie by the backend — no
    // action required here for the refresh token.
    if (accessToken) {
      setAccessToken(accessToken);
    }
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutUser = useCallback(async () => {
    try {
      // FIX (HIGH): Tell the server to revoke the current access token and
      // clear the httpOnly refresh cookie. Without this call, the refresh
      // cookie remains valid until it naturally expires.
      await authAPI.logout();
    } catch {
      // Even if the server call fails, clear client state
    } finally {
      clearAccessToken();
      localStorage.removeItem(USER_CACHE_KEY);
      setUser(null);
    }
  }, []);

  const isAuthenticated = !!user;

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
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
