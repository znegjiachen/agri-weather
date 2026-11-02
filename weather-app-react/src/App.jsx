import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AgentProvider } from './context/AgentContext';
import AppRoutes from './router';
import AppStatusBanner from './components/AppStatusBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

/** 未登录时只渲染登录/注册，登录后才挂载路由与布局 */
function AppGate() {
  const { isLoggedIn, authNotice } = useAuth();
  const [authMode, setAuthMode] = useState('login');

  if (!isLoggedIn) {
    return authMode === 'login'
      ? <Login onSwitch={() => setAuthMode('register')} notice={authNotice} />
      : <Register onSwitch={() => setAuthMode('login')} notice={authNotice} />;
  }

  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStatusBanner />
      <AuthProvider>
        <AgentProvider>
          <ErrorBoundary>
            <AppGate />
          </ErrorBoundary>
        </AgentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
