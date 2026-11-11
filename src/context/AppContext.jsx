import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Auth } from '../services/api';

// ─── Theme Context ─────────────────────────────────────────────
const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nd_theme') || 'light'; // clair par défaut
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nd_theme', theme);
  }, [theme]);

  const setDark  = () => setTheme('dark');
  const setLight = () => setTheme('light');
  const toggle   = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeCtx.Provider value={{ theme, dark: theme === 'dark', setDark, setLight, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}
export const useTheme = () => useContext(ThemeCtx);

// ─── Toast Context ─────────────────────────────────────────────
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="nd-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`nd-toast ${t.type}`}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[t.type] || '•'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ─── Auth Context ─────────────────────────────────────────────
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => Auth.user());
  const [logged, setLogged] = useState(() => Auth.logged());

  useEffect(() => {
    const interval = setInterval(() => {
      if (Auth.isTokenExpired() && Auth.token()) { Auth.logout(); }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const login = (token, userData) => {
    Auth.save(token, userData);
    setUser(userData);
    setLogged(true);
  };
  const logout = () => {
    Auth.logout();
    setUser(null);
    setLogged(false);
  };
  return (
    <AuthCtx.Provider value={{ user, logged, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
export const useAuth = () => useContext(AuthCtx);
