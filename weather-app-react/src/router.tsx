import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import HomePage from './pages/HomePage';

// 首屏只保留首页；其余页面按路由拆包，降低主包体积
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const CommunityPostPage = lazy(() => import('./pages/CommunityPostPage'));
const AgentPage = lazy(() => import('./pages/AgentPage'));
const AgentEntryPage = lazy(() => import('./pages/AgentEntryPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const CropPage = lazy(() => import('./pages/CropPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const FarmlandsPage = lazy(() => import('./pages/FarmlandsPage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const WeatherWidget = lazy(() => import('./components/WeatherWidget'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<p className="empty-text page-loading">页面加载中…</p>}>
      <Routes>
        <Route element={<AppLayout />}>
          {/* 一级：底部 4 个 Tab */}
          <Route index element={<HomePage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="community/:id" element={<CommunityPostPage />} />
          {/* 桌面端是智能体控制台，手机端仍进入聊天 */}
          <Route path="agent" element={<AgentEntryPage />} />
          <Route path="agent/chat" element={<AgentPage />} />
          <Route path="profile" element={<ProfilePage />} />

          {/* 二级：首页九宫格进入的功能页 */}
          <Route path="home/crops" element={<CropPage />} />
          <Route path="home/alerts" element={<AlertsPage />} />
          <Route path="home/farmlands" element={<FarmlandsPage />} />
          <Route path="home/map" element={<MapPage />} />
          <Route path="home/weather" element={<WeatherWidget />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}