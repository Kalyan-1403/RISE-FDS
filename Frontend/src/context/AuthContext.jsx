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
  const [reconnecting, setReconnecting] = useState(false);

  // ── Silent session restore on page load ──────────────────────────────────
  // FIX (CRITICAL): We no longer read tokens from localStorage.
  // Instead, we call /auth/refresh which uses the httpOnly refresh cookie
  // (sent automatically by the browser). If the cookie is valid, we receive
  // a fresh access token and store it in module memory only.
  useEffect(() => {
    const restoreSession = async () => {
      // First, try with cached user so UI loads instantly
      const cached = localStorage.getItem(USER_CACHE_KEY);
      if (cached) {
        try { setUser(JSON.parse(cached)); } catch { /* ignore */ }
      }
      setLoading(false);

      // Then silently verify session in background with retry for cold start
      const attemptRefresh = async (attempt = 0) => {
        try {
          const { data } = await authAPI.refresh();
          if (!data.access_token) throw new Error('No token');
          setAccessToken(data.access_token);
          try {
            const meResponse = await authAPI.me();
            if (meResponse.data?.user) {
              localStorage.setItem(USER_CACHE_KEY, JSON.stringify(meResponse.data.user));
              setUser(meResponse.data.user);
            }
          } catch {
            // /me failed but token is valid — keep cached user
          }
          setReconnecting(false);
        } catch (e) {
          if (!e.response && attempt < 4) {
            // No response = backend cold starting — show reconnecting UI and retry
            setReconnecting(true);
            const delay = [3000, 6000, 10000, 15000][attempt];
            await new Promise(res => setTimeout(res, delay));
            return attemptRefresh(attempt + 1);
          }
          // Genuinely failed — clear session
          setReconnecting(false);
          clearAccessToken();
          localStorage.removeItem(USER_CACHE_KEY);
          setUser(null);
        }
      };

      attemptRefresh();
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
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutUser = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Even if the server call fails, clear client state
    } finally {
      clearAccessToken();
      sessionStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
      setUser(null);
      // Hard redirect — clears all in-memory state and forces login page
      window.location.replace('/');
    }
  }, []);

  const isAuthenticated = !!user;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loginUser, logoutUser, loading, isAuthenticated, reconnecting }}>
      {reconnecting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white', textAlign: 'center', padding: '10px',
          fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px',
        }}>
          ⏳ Reconnecting to server — this takes ~30s on first load. Please wait…
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
