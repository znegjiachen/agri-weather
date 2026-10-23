import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import HomePage from './pages/HomePage';
import CommunityPage from './pages/CommunityPage';
import CommunityPostPage from './pages/CommunityPostPage';
import AgentPage from './pages/AgentPage';
import ProfilePage from './pages/ProfilePage';
import CropPage from './pages/CropPage';
import PestPage from './pages/PestPage';
import AlertsPage from './pages/AlertsPage';
import FarmlandsPage from './pages/FarmlandsPage';
import WeatherWidget from './components/WeatherWidget';

// 地图页带着 Leaflet（约 150KB），按需加载，别拖慢首屏
const MapPage = lazy(() => import('./pages/MapPage'));

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* 一级：底部 4 个 Tab */}
        <Route index element={<HomePage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/:id" element={<CommunityPostPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="profile" element={<ProfilePage />} />

        {/* 二级：首页九宫格进入的功能页 */}
        <Route path="home/crops" element={<CropPage />} />
        <Route path="home/pests" element={<PestPage />} />
        <Route path="home/alerts" element={<AlertsPage />} />
        <Route path="home/farmlands" element={<FarmlandsPage />} />
        <Route
          path="home/map"
          element={
            <Suspense fallback={<p className="empty-text">地图加载中…</p>}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="home/weather" element={<WeatherWidget />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
