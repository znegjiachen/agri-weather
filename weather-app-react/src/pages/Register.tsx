import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../utils/errorMessage';

interface RegisterProps {
  onSwitch: () => void;
  notice?: string;
}

interface AuthContextValue {
  register: (
    username: string,
    password: string,
    phone: string,
    region: string,
  ) => Promise<unknown>;
}

export default function Register({ onSwitch, notice }: RegisterProps) {
  const { register } = useAuth() as AuthContextValue;
  const [form, setForm] = useState({
    username: '', password: '', confirm: '', phone: '', region: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (form.password !== form.confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await register(
        form.username.trim(),
        form.password,
        form.phone.trim(),
        form.region.trim(),
      );
    } catch (err) {
      setError(errorMessage(err, '注册失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-heavy">
        <h2>🌾 注册账号</h2>
        <p className="auth-subtitle">加入问田</p>
        {notice && <div className="auth-notice" role="status">🔔 {notice}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className="auth-field">
            用户名
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="2~30 个字符"
              maxLength={30}
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
                name="new-password"
                autoComplete="new-password"
                placeholder="至少 6 位"
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
          <label className="auth-field">
            确认密码
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirm-password"
              autoComplete="new-password"
              placeholder="再输入一次"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </label>
          <label className="auth-field">
            手机号 <span className="auth-optional">（选填）</span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              placeholder="用于联系，不会公开"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="auth-field">
            所在地区 <span className="auth-optional">（选填，用于默认天气）</span>
            <input
              type="text"
              name="region"
              autoComplete="address-level2"
              maxLength={100}
              placeholder="如：湖南省长沙市"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>
        <p className="auth-switch">
          已有账号？
          <button type="button" className="auth-link" onClick={onSwitch}>立即登录</button>
        </p>
      </div>
    </div>
  );
}