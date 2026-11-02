import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onSwitch, notice }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username.trim(), form.password);
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-heavy">
        <h2>🌾 问田</h2>
        <p className="auth-subtitle">登录您的账号</p>
        {notice && <div className="auth-notice" role="status">🔔 {notice}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            用户名
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="请输入用户名"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label className="auth-field">
            密码
            <span className="auth-password">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </span>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <p className="auth-hint">忘记密码？请联系平台管理员重置。</p>
        <p className="auth-switch">
          还没有账号？
          <button type="button" className="auth-link" onClick={onSwitch}>立即注册</button>
        </p>
      </div>
    </div>
  );
}