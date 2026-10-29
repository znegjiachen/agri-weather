import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const AgentContext = createContext(null);
const EMPTY = [];

/**
 * 每个地块智能体独立的对话会话。
 *
 * 放在路由之上：切换页面时聊天记录不丢；
 * 用 agentId 作为 key，切换地块/智能体就切换对应会话。
 */
export function AgentProvider({ children }) {
  const { user } = useAuth();
  // key 变化时整个会话仓库重建，换用户不会读到上一位的记录
  return (
    <AgentSessionStore key={user?.userId ?? 'anonymous'}>
      {children}
    </AgentSessionStore>
  );
}

function AgentSessionStore({ children }) {
  const [sessions, setSessions] = useState({});

  const setSession = useCallback((key, updater) => {
    setSessions((prev) => {
      const current = prev[key] || EMPTY;
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [key]: Array.isArray(next) ? next : EMPTY };
    });
  }, []);

  const clearSession = useCallback((key) => {
    setSessions((prev) => {
      (prev[key] || EMPTY).forEach((message) => {
        (message.images || EMPTY).forEach((url) => URL.revokeObjectURL(url));
      });
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ sessions, setSession, clearSession }),
    [sessions, setSession, clearSession],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

/**
 * @param {string|number} agentKey 智能体 ID；没有智能体时用 'default'
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAgent(agentKey = 'default') {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be inside AgentProvider');

  const key = agentKey == null || agentKey === '' ? 'default' : String(agentKey);
  return {
    agentKey: key,
    messages: ctx.sessions[key] || EMPTY,
    setMessages: (updater) => ctx.setSession(key, updater),
    clearMessages: () => ctx.clearSession(key),
  };
}