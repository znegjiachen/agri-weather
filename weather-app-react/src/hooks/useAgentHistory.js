import { useEffect, useRef, useState } from 'react';
import { agents as agentsApi } from '../api';
import { useAgent } from '../context/AgentContext';

function mapDocuments(message) {
  const ids = Array.isArray(message.documentIds) && message.documentIds.length > 0
    ? message.documentIds
    : (message.documentId ? [message.documentId] : []);
  if (ids.length === 0 && !message.documentContext) return [];

  const names = (message.documentName || '上传的文档').split('、');
  return ids.map((id, index) => ({
    documentId: id,
    filename: names[index] || names[0] || '上传的文档',
    text: message.documentContext || '',
    charCount: message.documentContext?.length || 0,
    truncated: false,
  }));
}

function mapMessage(message) {
  return {
    role: message.role,
    content: message.content || '',
    vision: message.vision || null,
    documents: mapDocuments(message),
    document: mapDocuments(message)[0] || null,
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
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!agentId) return undefined;
    if (attempt === 0 && (requestedFor.current === agentId || isLoaded)) return undefined;
    requestedFor.current = agentId;
    let alive = true;
    setLoading(true);
    agentsApi.messages(agentId, 50)
      .then((list) => {
        if (!alive) return;
        setMessages(Array.isArray(list) ? list.map(mapMessage) : []);
        setError('');
      })
      .catch((err) => {
        // 不要静默当成空会话，否则用户会以为历史记录丢了
        if (alive) setError(err.message || '对话历史加载失败');
      })
      .finally(() => {
        if (!alive) return;
        markLoaded();
        setLoading(false);
      });
    return () => { alive = false; };
    // 只在智能体变化或手动重试时拉取；setMessages 等来自 context，避免把 effect 变成循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, attempt]);

  const retry = () => {
    setError('');
    setAttempt((value) => value + 1);
  };

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
    error,
    retry,
    loading: !!agentId && (loading || !isLoaded),
  };
}