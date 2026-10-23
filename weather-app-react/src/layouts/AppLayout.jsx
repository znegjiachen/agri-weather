import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import { SUB_NAV } from '../nav';

/**
 * 应用外壳：桌面端左侧栏 + 移动端底部 Tab，共用同一份路由。
 * 子页面（/home/*）自动带一层返回栏，不需要每个页面各写一遍。
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const sub = SUB_NAV.find((item) => item.to === pathname);

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        {sub && (
          <div className="subpage-bar">
            <button className="subpage-back" onClick={() => navigate('/')} aria-label="返回首页">
              ‹
            </button>
            <span className="subpage-title">{sub.icon} {sub.label}</span>
          </div>
        )}
        <Outlet />
      </main>

      <BottomTabBar />
    </div>
  );
}
