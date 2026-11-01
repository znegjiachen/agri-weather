import { useState } from 'react';
import { auth } from '../api';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { FARMER: '农户', ADMIN: '管理员' };

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();

  const [profile, setProfile] = useState({
    phone: user?.phone || '',
    region: user?.region || '',
  });
  const [profileState, setProfileState] = useState({ saving: false, message: '', error: '' });

  const [password, setPassword] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [passwordState, setPasswordState] = useState({ saving: false, message: '', error: '' });

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileState({ saving: true, message: '', error: '' });
    try {
      const data = await auth.updateProfile({
        phone: profile.phone.trim(),
        region: profile.region.trim(),
      });
      updateUser({
        phone: data.phone || '',
        region: data.region || '',
      });
      setProfile({ phone: data.phone || '', region: data.region || '' });
      setProfileState({ saving: false, message: '资料已保存', error: '' });
    } catch (e) {
      setProfileState({ saving: false, message: '', error: e.message || '保存失败' });
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (password.newPassword.length < 6) {
      setPasswordState({ saving: false, message: '', error: '新密码至少 6 位' });
      return;
    }
    if (password.newPassword !== password.confirm) {
      setPasswordState({ saving: false, message: '', error: '两次输入的新密码不一致' });
      return;
    }
    setPasswordState({ saving: true, message: '', error: '' });
    try {
      await auth.changePassword({
        oldPassword: password.oldPassword,
        newPassword: password.newPassword,
      });
      setPassword({ oldPassword: '', newPassword: '', confirm: '' });
      setPasswordState({ saving: false, message: '密码已修改', error: '' });
    } catch (e) {
      setPasswordState({ saving: false, message: '', error: e.message || '修改失败' });
    }
  };

  const handleLogout = () => {
    if (window.confirm('确定退出登录吗？')) logout();
  };

  return (
    <div className="profile-page">
      <div className="profile-col profile-col-side">
        <div className="profile-card glass">
          <div className="profile-avatar">👨‍🌾</div>
          <h2 className="profile-name">{user?.username}</h2>
          <p className="profile-role">{ROLE_LABEL[user?.role] || user?.role || '农户'}</p>

          <div className="profile-rows">
            <div className="profile-row">
              <span>用户 ID</span>
              <span>{user?.userId ?? '-'}</span>
            </div>
            <div className="profile-row">
              <span>手机号</span>
              <span>{user?.phone || '未设置'}</span>
            </div>
            <div className="profile-row">
              <span>地区</span>
              <span>{user?.region || '未设置'}</span>
            </div>
            <div className="profile-row">
              <span>账号类型</span>
              <span>{ROLE_LABEL[user?.role] || user?.role || '农户'}</span>
            </div>
          </div>

          <button className="btn-logout profile-logout" onClick={handleLogout}>
            退出登录
          </button>
        </div>

        <div className="profile-about glass">
          <h3>关于</h3>
          <p>问田 · 农事气象服务平台</p>
          <p className="profile-version">Spring Boot 3.5 · React 19 · Redis</p>
        </div>
      </div>

      <div className="profile-col profile-col-main">
        <section className="profile-card glass profile-section">
          <h3>账号资料</h3>
          <p className="profile-section-sub">地区会作为天气页的默认城市</p>
          {profileState.error && <div className="auth-error">{profileState.error}</div>}
          {profileState.message && <div className="auth-success">{profileState.message}</div>}
          <form className="profile-form" onSubmit={saveProfile}>
            <div className="profile-form-grid">
              <label>
                手机号
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  maxLength={20}
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="选填"
                />
              </label>
              <label>
                所在地区
                <input
                  type="text"
                  name="region"
                  autoComplete="address-level2"
                  maxLength={100}
                  value={profile.region}
                  onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                  placeholder="如：湖南省长沙市"
                />
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={profileState.saving}>
              {profileState.saving ? '保存中…' : '保存资料'}
            </button>
          </form>
        </section>

        <section className="profile-card glass profile-section">
          <h3>修改密码</h3>
          <p className="profile-section-sub">新密码至少 6 位</p>
          {passwordState.error && <div className="auth-error">{passwordState.error}</div>}
          {passwordState.message && <div className="auth-success">{passwordState.message}</div>}
          <form className="profile-form" onSubmit={savePassword}>
            <label>
              原密码
              <input
                type="password"
                name="old-password"
                autoComplete="current-password"
                value={password.oldPassword}
                onChange={(e) => setPassword({ ...password, oldPassword: e.target.value })}
                required
              />
            </label>
            <div className="profile-form-grid">
              <label>
                新密码
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  value={password.newPassword}
                  onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                  required
                />
              </label>
              <label>
                确认新密码
                <input
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={password.confirm}
                  onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                  required
                />
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={passwordState.saving}>
              {passwordState.saving ? '修改中…' : '修改密码'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}