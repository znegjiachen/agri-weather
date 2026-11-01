import { useEffect, useState } from 'react';
import { auth } from '../api';
import { useAuth } from '../context/AuthContext';

function notificationLabel(permission) {
  if (permission === 'granted') return '已开启 · 有新预警时提醒';
  if (permission === 'denied') return '已被浏览器禁用，请在浏览器设置中开启';
  if (permission === 'unsupported') return '当前浏览器不支持通知';
  return '未开启 · 点击允许浏览器通知';
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();

  const [sheet, setSheet] = useState(null); // profile | password
  const [pageNotice, setPageNotice] = useState('');
  const [permission, setPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));

  const [profile, setProfile] = useState({
    phone: user?.phone || '',
    region: user?.region || '',
  });
  const [profileState, setProfileState] = useState({ saving: false, message: '', error: '' });

  const [password, setPassword] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [passwordState, setPasswordState] = useState({ saving: false, message: '', error: '' });

  const showNotice = (text) => {
    setPageNotice(text);
    window.setTimeout(() => setPageNotice(''), 2500);
  };

  const openSheet = (name) => {
    setSheet(name);
    if (name === 'profile') {
      setProfile({ phone: user?.phone || '', region: user?.region || '' });
    } else {
      setPassword({ oldPassword: '', newPassword: '', confirm: '' });
    }
    setProfileState({ saving: false, message: '', error: '' });
    setPasswordState({ saving: false, message: '', error: '' });
  };
  const closeSheet = () => setSheet(null);

  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

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
      setProfileState({ saving: false, message: '', error: '' });
      closeSheet();
      showNotice('资料已保存');
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
      setPasswordState({ saving: false, message: '', error: '' });
      closeSheet();
      showNotice('密码已修改');
    } catch (e) {
      setPasswordState({ saving: false, message: '', error: e.message || '修改失败' });
    }
  };

  const requestNotification = async () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'denied') {
      showNotice('通知已被浏览器禁用，请在浏览器设置中开启');
      return;
    }
    if (Notification.permission === 'granted') {
      showNotice('预警通知已开启');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    showNotice(result === 'granted' ? '预警通知已开启' : '未获得通知权限');
  };

  const handleLogout = () => {
    if (window.confirm('确定退出登录吗？')) logout();
  };

  return (
    <div className="profile-page">
      <header className="page-header">
        <div>
          <h2 className="page-title">👤 个人中心</h2>
          <p className="page-subtitle">管理账号资料与安全设置</p>
        </div>
      </header>

      <section className="profile-hero glass">
        <div className="profile-hero-main">
          <div className="profile-avatar">👨‍🌾</div>
          <div className="profile-hero-text">
            <h3 className="profile-name">{user?.username}</h3>
          </div>
        </div>
        <div className="profile-hero-chips">
          <span className="profile-chip">📱 {user?.phone || '未设置手机号'}</span>
          <span className="profile-chip">📍 {user?.region || '未设置地区'}</span>
        </div>
      </section>

      {pageNotice && <div className="profile-toast" role="status">{pageNotice}</div>}

      <section className="settings-group glass">
        <button type="button" className="settings-row" onClick={() => openSheet('profile')}>
          <span className="settings-row-icon" aria-hidden>📝</span>
          <span className="settings-row-text">
            <b>账号资料</b>
            <small>{user?.phone || '未设置手机号'} · {user?.region || '未设置地区'}</small>
          </span>
          <span className="settings-row-arrow" aria-hidden>›</span>
        </button>

        <button type="button" className="settings-row" onClick={() => openSheet('password')}>
          <span className="settings-row-icon" aria-hidden>🔒</span>
          <span className="settings-row-text">
            <b>修改密码</b>
            <small>定期更换密码，保护账号安全</small>
          </span>
          <span className="settings-row-arrow" aria-hidden>›</span>
        </button>

        <button type="button" className="settings-row" onClick={requestNotification}>
          <span className="settings-row-icon" aria-hidden>🔔</span>
          <span className="settings-row-text">
            <b>预警通知</b>
            <small>{notificationLabel(permission)}</small>
          </span>
          <span className={`settings-switch ${permission === 'granted' ? 'on' : ''}`} aria-hidden />
        </button>

        <div className="settings-row static">
          <span className="settings-row-icon" aria-hidden>ℹ️</span>
          <span className="settings-row-text">
            <b>关于问田</b>
            <small>农事气象服务平台 · Spring Boot 3.5 · React 19 · Redis</small>
          </span>
        </div>
      </section>

      <button type="button" className="settings-logout" onClick={handleLogout}>
        退出登录
      </button>

      {sheet === 'profile' && (
        <div
          className="form-overlay"
          onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }}
        >
          <div
            className="settings-sheet glass-heavy"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-sheet-title"
          >
            <div className="settings-sheet-head">
              <h3 id="profile-sheet-title">账号资料</h3>
              <button type="button" onClick={closeSheet} aria-label="关闭">×</button>
            </div>
            {profileState.error && <div className="auth-error">{profileState.error}</div>}
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
              <p className="settings-sheet-hint">地区会作为天气页的默认城市。</p>
              <div className="settings-sheet-actions">
                <button type="button" className="btn-cancel" onClick={closeSheet}>取消</button>
                <button type="submit" className="btn-primary" disabled={profileState.saving}>
                  {profileState.saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sheet === 'password' && (
        <div
          className="form-overlay"
          onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }}
        >
          <div
            className="settings-sheet glass-heavy"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-sheet-title"
          >
            <div className="settings-sheet-head">
              <h3 id="password-sheet-title">修改密码</h3>
              <button type="button" onClick={closeSheet} aria-label="关闭">×</button>
            </div>
            {passwordState.error && <div className="auth-error">{passwordState.error}</div>}
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
                    placeholder="至少 6 位"
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
              <div className="settings-sheet-actions">
                <button type="button" className="btn-cancel" onClick={closeSheet}>取消</button>
                <button type="submit" className="btn-primary" disabled={passwordState.saving}>
                  {passwordState.saving ? '修改中…' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}