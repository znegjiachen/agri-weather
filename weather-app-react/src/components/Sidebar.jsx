import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_NAV, SUB_NAV, isNavActive } from '../nav';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <nav className="sidebar glass-heavy">
      <div className="nav-brand">
        <span className="nav-logo">🌾</span>
        <span>曾嘉晨农事气象</span>
      </div>

      <div className="nav-links">
        {PRIMARY_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={isNavActive(pathname, item.to) ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.label}</span>
          </Link>
        ))}

        <div className="nav-divider" />

        {SUB_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-sub ${pathname === item.to ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="nav-footer">
        <div className="nav-user">
          <span>👨‍🌾 {user?.username}</span>
        </div>
        <button className="btn-logout" onClick={logout}>退出登录</button>
      </div>
    </nav>
  );
}
