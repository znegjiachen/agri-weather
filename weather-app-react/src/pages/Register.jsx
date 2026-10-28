import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Register({ onSwitch }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', phone: '', region: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.password, form.phone, form.region);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-heavy">
        <h2>🌾 注册账号</h2>
        <p className="auth-subtitle">加入问田</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="用户名 *"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="密码 *"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="手机号"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            type="text"
            placeholder="所在地区（如：河北省石家庄市）"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <button type="submit" disabled={loading}>
            {loading ? '注册中...' : '注 册'}
          </button>
        </form>
        <p className="auth-switch">
          已有账号？<span onClick={onSwitch}>立即登录</span>
        </p>
      </div>
    </div>
  );
}
