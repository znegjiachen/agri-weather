import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <div className="profile-page">
      <div className="profile-card glass">
        <div className="profile-avatar">👨‍🌾</div>
        <h2 className="profile-name">{user?.username}</h2>
        <p className="profile-role">
          {user?.role === 'FARMER' ? '农户' : user?.role || '农户'}
        </p>

        <div className="profile-rows">
          <div className="profile-row">
            <span>用户 ID</span>
            <span>{user?.userId ?? '-'}</span>
          </div>
          <div className="profile-row">
            <span>地区</span>
            <span>{user?.region || '未设置'}</span>
          </div>
          <div className="profile-row">
            <span>账号类型</span>
            <span>{user?.role || 'FARMER'}</span>
          </div>
        </div>

        <button className="btn-logout profile-logout" onClick={logout}>
          退出登录
        </button>
      </div>

      <div className="profile-about glass">
        <h3>关于</h3>
        <p>曾嘉晨智慧农事气象服务平台</p>
        <p className="profile-version">Spring Boot 3.5 · React 19 · Redis</p>
      </div>
    </div>
  );
}
