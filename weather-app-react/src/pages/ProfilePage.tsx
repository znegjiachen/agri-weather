import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { auth, community } from '../api';
import { useAuth } from '../context/AuthContext';
import { getPushStatus, enablePush, disablePush } from '../utils/push';
import { errorMessage } from '../utils/errorMessage';

interface AuthUser {
  username?: string;
  phone?: string;
  region?: string;
  avatar?: string;
}

/** AuthContext 是 JS 模块，这里声明个人中心实际使用的上下文形状 */
interface AuthContextValue {
  user: AuthUser | null;
  logout: () => void;
  logoutAll: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
}

interface ProfileForm {
  phone: string;
  region: string;
}

interface PasswordForm {
  oldPassword: string;
  newPassword: string;
  confirm: string;
}

interface FormState {
  saving: boolean;
  message: string;
  error: string;
}

interface PushStatus {
  state: string;
}

function pushLabel(state: string): string {
  if (state === 'subscribed') return '已开启 · 新预警会推送到浏览器';
  if (state === 'denied') return '已被浏览器禁用，请在浏览器设置中开启';
  if (state === 'unsupported') return '当前浏览器不支持 Web Push';
  if (state === 'unavailable') return '页面尚未启用离线服务，请刷新后重试';
  if (state === 'server-disabled') return '服务端未配置 VAPID 密钥';
  if (state === 'error') return '状态检查失败，点击重试';
  if (state === 'loading') return '正在检查推送状态…';
  return '未开启 · 点击订阅预警推送';
}

export default function ProfilePage() {
  const { user, logout, logoutAll, deleteAccount, updateUser } = useAuth() as AuthContextValue;

  const [sheet, setSheet] = useState<'profile' | 'password' | null>(null); // profile | password
  const [pageNotice, setPageNotice] = useState('');
  const [pushStatus, setPushStatus] = useState<PushStatus>({ state: 'loading' });

  const [profile, setProfile] = useState<ProfileForm>({
    phone: user?.phone || '',
    region: user?.region || '',
  });
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [profileState, setProfileState] = useState<FormState>({ saving: false, message: '', error: '' });

  const [password, setPassword] = useState<PasswordForm>({ oldPassword: '', newPassword: '', confirm: '' });
  const [passwordState, setPasswordState] = useState<FormState>({ saving: false, message: '', error: '' });

  const showNotice = (text: string) => {
    setPageNotice(text);
    window.setTimeout(() => setPageNotice(''), 2500);
  };

  const handleAvatarFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png)$/i.test(file.type)) {
      showNotice('头像仅支持 JPG / PNG');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showNotice('头像不能超过 5MB');
      return;
    }
    setAvatarSaving(true);
    try {
      const image = await community.uploadImage(file);
      const data = await auth.updateProfile({ avatar: image.url });
      updateUser({ avatar: data.avatar || image.url });
      showNotice('头像已更新');
    } catch (e) {
      showNotice(errorMessage(e, '头像上传失败'));
    } finally {
      setAvatarSaving(false);
    }
  };

  const openSheet = (name: 'profile' | 'password') => {
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
    let alive = true;
    getPushStatus()
      .then((status) => { if (alive) setPushStatus(status); })
      .catch(() => { if (alive) setPushStatus({ state: 'error' }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
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
      setProfileState({ saving: false, message: '', error: errorMessage(e, '保存失败') });
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
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
      setPasswordState({ saving: false, message: '', error: errorMessage(e, '修改失败') });
    }
  };

  const togglePush = async () => {
    const state = pushStatus.state;
    if (state === 'loading') return;

    if (state === 'denied') {
      showNotice('通知已被浏览器禁用，请在浏览器设置中开启');
      return;
    }
    if (state === 'server-disabled') {
      showNotice('服务端尚未配置 VAPID 密钥，暂不能推送');
      return;
    }
    if (state === 'unsupported') {
      showNotice('当前浏览器不支持 Web Push');
      return;
    }
    if (state === 'unavailable') {
      showNotice('页面尚未启用离线服务，请刷新后重试');
      return;
    }

    setPushStatus({ state: 'loading' });
    try {
      if (state === 'subscribed') {
        await disablePush();
        setPushStatus({ state: 'available' });
        showNotice('已关闭预警推送');
      } else {
        await enablePush();
        setPushStatus({ state: 'subscribed' });
        showNotice('已开启预警推送');
      }
    } catch (e) {
      setPushStatus({ state: 'error' });
      showNotice(errorMessage(e, '推送设置失败'));
    }
  };

  const handleLogout = () => {
    if (window.confirm('确定退出登录吗？')) logout();
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('确定退出全部设备吗？其他设备上的登录会立即失效。')) return;
    try {
      await logoutAll();
    } catch (e) {
      showNotice(errorMessage(e, '操作失败'));
    }
  };

  const handleDeleteAccount = async () => {
    const password = window.prompt('注销后数据无法恢复，请输入密码确认：');
    if (!password) return;
    if (!window.confirm('最后确认：注销账号并删除全部地块、对话和社区内容？')) return;
    try {
      await deleteAccount(password);
    } catch (e) {
      showNotice(errorMessage(e, '注销失败'));
    }
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
          <button
            type="button"
            className="profile-avatar"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarSaving}
            title="更换头像"
            aria-label="更换头像"
          >
            {user?.avatar ? <img src={user.avatar} alt="头像" /> : '👨‍🌾'}
            <span className="profile-avatar-edit" aria-hidden>📷</span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            onChange={handleAvatarFile}
          />
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

        <button type="button" className="settings-row" onClick={togglePush}>
          <span className="settings-row-icon" aria-hidden>🔔</span>
          <span className="settings-row-text">
            <b>预警通知</b>
            <small>{pushLabel(pushStatus.state)}</small>
          </span>
          <span className={`settings-switch ${pushStatus.state === 'subscribed' ? 'on' : ''}`} aria-hidden />
        </button>

        <div className="settings-row static">
          <span className="settings-row-icon" aria-hidden>ℹ️</span>
          <span className="settings-row-text">
            <b>关于问田</b>
            <small>农事气象服务平台 · Spring Boot 3.5 · React 19 · Redis</small>
          </span>
        </div>

        <button type="button" className="settings-row" onClick={handleLogoutAll}>
          <span className="settings-row-icon" aria-hidden>📤</span>
          <span className="settings-row-text">
            <b>退出全部设备</b>
            <small>使其他设备上的登录立即失效</small>
          </span>
          <span className="settings-row-arrow" aria-hidden>›</span>
        </button>

        <button type="button" className="settings-row danger" onClick={handleDeleteAccount}>
          <span className="settings-row-icon" aria-hidden>🗑️</span>
          <span className="settings-row-text">
            <b>注销账号</b>
            <small>删除地块、对话和社区内容，不可恢复</small>
          </span>
          <span className="settings-row-arrow" aria-hidden>›</span>
        </button>
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