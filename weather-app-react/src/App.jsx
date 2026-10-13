import { useEffect, useState } from 'react';
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

  // 农事助手的对话状态提升到这一层。
  // AgentPage 是条件渲染的，切板块时会被卸载，state 放在它内部会随组件一起销毁。
  const [agentMessages, setAgentMessages] = useState([]);

  // 换用户（含主动登出、token 过期导致的登出）时清空对话，
  // 避免同浏览器下下一位登录者看到上一位的聊天记录。
  const userId = user?.userId;
  useEffect(() => {
    setAgentMessages([]);
  }, [userId]);

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
        {page === 'agent' && (
          <AgentPage messages={agentMessages} setMessages={setAgentMessages} />
        )}
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
