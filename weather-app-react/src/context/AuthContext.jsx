/* eslint-disable react-refresh/only-export-components -- Provider 与 useAuth 成对导出 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { auth } from '../api';
import { clearApiCache } from '../utils/pwaCaches';
import { clearFieldContext } from '../utils/fieldContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  // 登录过期等提示：退出后仍需要在登录页展示一次
  const [authNotice, setAuthNotice] = useState('');

  const saveUser = useCallback((userData, token, refreshToken) => {
    localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setAuthNotice('');
    // 换了身份，之前缓存的离线数据不再适用
    clearApiCache();
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await auth.login({ username, password });
    saveUser({
      username: data.username,
      role: data.role,
      userId: data.userId,
      phone: data.phone || '',
      region: data.region || '',
      avatar: data.avatar || '',
    }, data.token, data.refreshToken);
    return data;
  }, [saveUser]);

  const register = useCallback(async (username, password, phone, region) => {
    const data = await auth.register({ username, password, phone, region });
    saveUser({
      username: data.username,
      role: data.role,
      userId: data.userId,
      phone: data.phone || '',
      region: data.region || '',
      avatar: data.avatar || '',
    }, data.token, data.refreshToken);
    return data;
  }, [saveUser]);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearLocal = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    clearApiCache();
    // 避免下一位登录者看到上一位用户的地块上下文
    clearFieldContext();
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      auth.logout(refreshToken).catch(() => {});
    }
    clearLocal();
  }, [clearLocal]);

  const logoutAll = useCallback(async () => {
    await auth.logoutAll();
    clearLocal();
  }, [clearLocal]);

  const deleteAccount = useCallback(async (password) => {
    await auth.deleteAccount(password);
    clearLocal();
  }, [clearLocal]);

  // 老账号的 localStorage 里可能没有手机号/地区，登录后补拉一次资料
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    auth.profile()
      .then((data) => {
        updateUser({
          username: data.username,
          role: data.role,
          userId: data.userId,
          phone: data.phone || '',
          region: data.region || '',
          avatar: data.avatar || '',
        });
      })
      .catch(() => {});
  }, [updateUser]);

  // 监听全局401事件（API层token过期时触发），把原因带到登录页
  useEffect(() => {
    const handler = (event) => {
      setAuthNotice(event.detail || '登录已过期，请重新登录');
      logout();
    };
    window.addEventListener('auth:expired', handler);
    return () => window.removeEventListener('auth:expired', handler);
  }, [logout]);

  // API 层自动刷新成功后，同步 Context 里的用户信息
  useEffect(() => {
    const handler = (event) => {
      const data = event.detail || {};
      updateUser({
        username: data.username,
        role: data.role,
        userId: data.userId,
        phone: data.phone || '',
        region: data.region || '',
        avatar: data.avatar || '',
      });
      setAuthNotice('');
    };
    window.addEventListener('auth:refreshed', handler);
    return () => window.removeEventListener('auth:refreshed', handler);
  }, [updateUser]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      logoutAll,
      deleteAccount,
      updateUser,
      authNotice,
      clearAuthNotice: () => setAuthNotice(''),
      isLoggedIn: !!user,
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}