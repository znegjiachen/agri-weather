import { useEffect, useRef, useState } from 'react';
import { agents as agentsApi } from '../api';
import { useAgent } from '../context/AgentContext';

function mapMessage(message) {
  return {
    role: message.role,
    content: message.content || '',
    vision: message.vision || null,
    toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : [],
    thoughts: Array.isArray(message.thoughts) ? message.thoughts : [],
    knowledgeUsed: Array.isArray(message.knowledgeUsed) ? message.knowledgeUsed : [],
    streaming: false,
  };
}

/**
 * 加载某个智能体的持久化对话历史（每个智能体只拉一次）。
 *
 * AgentContext 里用 loaded 标记避免切换回同一个智能体时重复请求；
 * 图片预览不落库，历史里只恢复文字和结构化识别结果。
 */
export function useAgentHistory(agentId) {
  const session = useAgent(agentId || 'default');
  const { messages, setMessages, clearMessages, markLoaded, isLoaded } = session;
  const requestedFor = useRef(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return undefined;
    if (requestedFor.current === agentId || isLoaded) return undefined;
    requestedFor.current = agentId;
    let alive = true;
    setLoading(true);
    agentsApi.messages(agentId, 50)
      .then((list) => {
        if (!alive) return;
        setMessages(Array.isArray(list) ? list.map(mapMessage) : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        markLoaded();
        setLoading(false);
      });
    return () => { alive = false; };
    // 只在智能体变化时拉取；setMessages 等来自 context，避免把 effect 变成循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const clearHistory = async () => {
    if (agentId) {
      try {
        await agentsApi.clearMessages(agentId);
      } catch {
        // 本地清空仍然生效，后端失败下次刷新会重新出现
      }
    }
    clearMessages();
  };

  return {
    messages,
    setMessages,
    clearHistory,
    clearMessages,
    loading: !!agentId && (loading || !isLoaded),
  };
}