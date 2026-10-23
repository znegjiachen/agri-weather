import { Link, useLocation } from 'react-router-dom';
import { PRIMARY_NAV, isNavActive } from '../nav';

/** 手机端底部导航（≤768px 显示，桌面端由 .sidebar 承担） */
export default function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <nav className="bottom-tab glass-heavy">
      {PRIMARY_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`tab-item ${isNavActive(pathname, item.to) ? 'active' : ''}`}
        >
          <span className="tab-icon">{item.icon}</span>
          <span className="tab-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
