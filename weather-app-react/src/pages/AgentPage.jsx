import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { agent as agentApi } from '../api';
import { useAgent } from '../context/AgentContext';

const TOOL_LABELS = {
  list_farmlands: { icon: '📍', label: '查询地块列表' },
  get_farmland_detail: { icon: '📋', label: '读取地块详情' },
  get_weather: { icon: '🌤️', label: '获取天气预报' },
  get_crop_stage: { icon: '🌱', label: '判断生长阶段' },
  get_operation_advice: { icon: '📅', label: '调用农事决策引擎' },
  check_alerts: { icon: '⚠️', label: '检查灾害预警' },
  search_crop: { icon: '📚', label: '检索作物知识库' },
};

const SUGGESTIONS = [
  '我那块地明天适合打药吗？',
  '未来一周哪天适合施肥？',
  '我的作物现在处于什么生长阶段？',
  '最近有冻害或涝害风险吗？',
];

/**
 * 农事助手对话页。
 *
 * messages 由 App 持有并传入 —— 本组件是条件渲染的，切板块时会被卸载，
 * 状态放在这里会随组件一起丢失。其余状态（草稿、加载中、错误）是瞬时的，
 * 留在本地即可。
 */
export default function AgentPage() {
  // 对话状态放在 AgentContext：切 Tab 时本组件会卸载，状态留在这里会丢
  const { messages, setMessages } = useAgent();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    agentApi.status()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  // 新消息进来时滚到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    setError('');
    setInput('');

    // 历史只取 user/assistant 的纯文本，工具轨迹不往上传
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await agentApi.chat(content, history);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          toolCalls: res.toolCalls || [],
          rounds: res.rounds,
          truncated: res.truncated,
        },
      ]);
    } catch (e) {
      setError(e.message || '调用失败');
      // 失败时把用户消息撤掉，避免历史里留下没有回复的孤条
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError('');
  };

  const notConfigured = status && status.configured === false;

  return (
    <div className="agent-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">🤖 农事智能助手</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            会自己查天气、查地块、调用决策引擎，再给你建议
          </p>
        </div>
        {messages.length > 0 && (
          <button className="btn-cancel" onClick={clearChat} style={{ padding: '8px 16px', fontSize: 13 }}>
            🗑 清空对话
          </button>
        )}
      </div>

      {notConfigured && (
        <div className="agent-warning">
          <strong>⚠️ 智能助手尚未启用</strong>
          <p>
            后端没有配置 DeepSeek API Key。请设置环境变量
            <code>DEEPSEEK_API_KEY</code> 后重启服务。
          </p>
        </div>
      )}

      <div className="agent-window glass">
        <div className="agent-messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="agent-welcome">
              <div className="agent-welcome-icon">🌾</div>
              <h3>你好，我是农事助手</h3>
              <p>你可以问我关于地块、天气和农事安排的问题。</p>

              <div className="agent-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="agent-suggestion"
                    onClick={() => send(s)}
                    disabled={loading || notConfigured}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`agent-msg agent-msg-${m.role}`}>
              <div className="agent-avatar">{m.role === 'user' ? '👨‍🌾' : '🤖'}</div>
              <div className="agent-bubble-wrap">
                {/* 工具调用过程 —— 让用户看见它查了什么 */}
                {m.toolCalls?.length > 0 && (
                  <ToolCallList calls={m.toolCalls} />
                )}

                {/* 助手回复按 Markdown 渲染；用户输入保持原文，避免被当成标记解析 */}
                <div className="agent-bubble">
                  {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                </div>

                {m.truncated && (
                  <div className="agent-note">
                    回答可能不完整（已达到工具调用轮数上限），可以试着把问题问得更具体
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="agent-msg agent-msg-assistant">
              <div className="agent-avatar">🤖</div>
              <div className="agent-bubble-wrap">
                <div className="agent-bubble agent-thinking">
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    正在查阅数据…
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="agent-error">
            {error}
          </div>
        )}

        <div className="agent-input-bar">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="问我任何农事问题…（Enter 发送，Shift+Enter 换行）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || notConfigured}
          />
          <button
            className="btn-primary agent-send"
            onClick={() => send()}
            disabled={loading || !input.trim() || notConfigured}
          >
            {loading ? '…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 工具调用轨迹：默认折叠，点开看详情 */
function ToolCallList({ calls }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tool-trace">
      <button className="tool-trace-toggle" onClick={() => setOpen(!open)}>
        <span className="tool-trace-summary">
          {calls.map((c) => TOOL_LABELS[c.tool]?.icon || '🔧').join(' ')}
          {' '}已查询 {calls.length} 项数据
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {open ? '收起 ▲' : '展开 ▼'}
        </span>
      </button>

      {open && (
        <div className="tool-trace-body">
          {calls.map((c, i) => {
            const meta = TOOL_LABELS[c.tool] || { icon: '🔧', label: c.tool };
            return (
              <div key={i} className="tool-trace-item">
                <div className="tool-trace-head">
                  <span>{meta.icon} {meta.label}</span>
                  <code>{c.tool}</code>
                  <span className="tool-trace-time">{c.elapsedMs}ms</span>
                </div>
                {c.arguments && c.arguments !== '{}' && (
                  <div className="tool-trace-args">参数：{c.arguments}</div>
                )}
                <div className="tool-trace-result">{c.resultSummary}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
