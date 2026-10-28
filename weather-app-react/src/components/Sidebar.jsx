import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { alerts as alertsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_NAV, SUB_NAV, isNavActive } from '../nav';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  // 每次切页刷新一次，读完预警回来角标能及时消失
  useEffect(() => {
    let alive = true;
    alertsApi.unreadCount()
      .then((count) => { if (alive) setUnread(count); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  return (
    <nav className="sidebar glass-heavy">
      <div className="nav-brand">
        <span className="nav-logo-mark">田</span>
        <span className="nav-brand-text">
          <span className="nav-brand-name">问田</span>
          <span className="nav-brand-sub">WÈN TIÁN</span>
        </span>
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
        <span className="nav-group-label">功能</span>

        {SUB_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-sub ${pathname === item.to ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.label}</span>
            {item.to === '/home/alerts' && unread > 0 && (
              <span className="nav-badge">{unread > 99 ? '99+' : unread}</span>
            )}
          </Link>
        ))}
      </div>

      <div className="nav-footer">
        <div className="nav-user">
          <span className="nav-avatar">{(user?.username || '农').slice(0, 1)}</span>
          <span className="nav-user-name">{user?.username}</span>
        </div>
        <button className="btn-logout" onClick={logout}>退出登录</button>
      </div>
    </nav>
  );
}
