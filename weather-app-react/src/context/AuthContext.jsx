import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { auth } from '../api';
import { clearApiCache } from '../utils/pwaCaches';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const saveUser = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    // 换了身份，之前缓存的离线数据不再适用
    clearApiCache();
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await auth.login({ username, password });
    saveUser({ username: data.username, role: data.role, userId: data.userId }, data.token);
    return data;
  }, [saveUser]);

  const register = useCallback(async (username, password, phone, region) => {
    const data = await auth.register({ username, password, phone, region });
    saveUser({ username: data.username, role: data.role, userId: data.userId }, data.token);
    return data;
  }, [saveUser]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    clearApiCache();
  }, []);

  // 监听全局401事件（API层token过期时触发）
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
