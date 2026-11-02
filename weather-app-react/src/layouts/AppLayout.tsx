import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BottomTabBar from '../components/BottomTabBar';
import AgentDock from '../components/AgentDock';
import AlertNotifier from '../components/AlertNotifier';
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
  const isDockWide = useMediaQuery('(min-width: 1600px)');

  const sub = SUB_NAV.find((item) => item.to === pathname);
  // 完整对话页已经有整页聊天；其他页面在桌面端保留助手。
  const showDock = isWide && pathname !== '/agent/chat';

  return (
    <div className="app-layout">
      <AlertNotifier />
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

      {/* 小于 1600px 时默认收起为侧边标签，避免固定 360px 的浮窗把驾驶舱挤扁 */}
      {showDock && <AgentDock defaultCollapsed={!isDockWide} />}

      <BottomTabBar />
    </div>
  );
}
