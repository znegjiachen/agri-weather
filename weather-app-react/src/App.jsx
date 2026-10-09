import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CropPage from './pages/CropPage';
import PestPage from './pages/PestPage';
import AlertsPage from './pages/AlertsPage';
import FarmlandsPage from './pages/FarmlandsPage';
import AgentPage from './pages/AgentPage';
import WeatherWidget from './components/WeatherWidget';
import './App.css';

function AppContent() {
  const { user, isLoggedIn, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [authMode, setAuthMode] = useState('login');

  if (!isLoggedIn) {
    return authMode === 'login'
      ? <Login onSwitch={() => setAuthMode('register')} />
      : <Register onSwitch={() => setAuthMode('login')} />;
  }

  return (
    <div className="app-layout">
      <nav className="sidebar glass-heavy">
        <div className="nav-brand">
          <span className="nav-logo">🌾</span>
          <span>曾嘉晨农事气象</span>
        </div>

        <div className="nav-links">
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>
            📊 工作台
          </button>
          <button className={page === 'agent' ? 'active' : ''} onClick={() => setPage('agent')}>
            🤖 农事助手
          </button>
          <button className={page === 'crops' ? 'active' : ''} onClick={() => setPage('crops')}>
            🌱 作物适配
          </button>
          <button className={page === 'pests' ? 'active' : ''} onClick={() => setPage('pests')}>
            🐛 病虫害库
          </button>
          <button className={page === 'alerts' ? 'active' : ''} onClick={() => setPage('alerts')}>
            🔔 预警中心
          </button>
          <button className={page === 'farmlands' ? 'active' : ''} onClick={() => setPage('farmlands')}>
            📍 地块管理
          </button>
          <button className={page === 'weather' ? 'active' : ''} onClick={() => setPage('weather')}>
            🌤️ 天气预报
          </button>
        </div>

        <div className="nav-footer">
          <div className="nav-user">
            <span>👨‍🌾 {user?.username}</span>
          </div>
          <button className="btn-logout" onClick={logout}>退出登录</button>
        </div>
      </nav>

      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'agent' && <AgentPage />}
        {page === 'crops' && <CropPage />}
        {page === 'pests' && <PestPage />}
        {page === 'alerts' && <AlertsPage />}
        {page === 'farmlands' && <FarmlandsPage />}
        {page === 'weather' && <WeatherWidget />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
