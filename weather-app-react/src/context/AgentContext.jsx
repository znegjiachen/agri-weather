import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const AgentContext = createContext(null);

/**
 * 农事助手的对话状态。
 *
 * 放在路由之上：切到别的 Tab 时 AgentPage 会被卸载，
 * 状态若留在组件内，回来聊天记录就没了。
 */
export function AgentProvider({ children }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);

  const userId = user?.userId;

  // 换用户（登出、换号、token 过期）时清空，避免下一位登录者看到上一位的记录
  useEffect(() => {
    setMessages([]);
  }, [userId]);

  return (
    <AgentContext.Provider value={{ messages, setMessages }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be inside AgentProvider');
  return ctx;
}
