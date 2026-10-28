import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import AgentDock from '../components/AgentDock';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { SUB_NAV } from '../nav';

/**
 * 应用外壳：桌面端左侧栏 + 右侧常驻助农手，移动端底部 Tab，共用同一份路由。
 * 子页面（/home/*）自动带一层返回栏，不需要每个页面各写一遍。
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 1200px)');

  const sub = SUB_NAV.find((item) => item.to === pathname);
  // 完整对话页已经有整页聊天，不再重复挂浮窗
  const showDock = isWide && pathname !== '/agent';

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

      {showDock && <AgentDock />}

      <BottomTabBar />
    </div>
  );
}
