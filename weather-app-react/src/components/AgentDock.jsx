import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import { agent as agentApi } from '../api';
import { useAgent } from '../context/AgentContext';
import { MAX_IMAGES, compressImage } from '../utils/image';
import { formatVision } from '../utils/agentVision';
import { TOOL_LABELS } from '../utils/agentTools';
import { getFieldContext } from '../utils/fieldContext';

const SUGGESTIONS = [
  '明天适合打药吗？',
  '未来一周哪天适合施肥？',
  '作物现在是什么生长阶段？',
];

/**
 * 桌面端常驻的助农手浮窗。
 *
 * 与 /agent 共用 AgentContext 里的 messages，所以两边看到的是同一段对话；
 * 这里做紧凑版渲染（工具轨迹 + 回答），照片识别结果用一行摘要展示。
 */
export default function AgentDock() {
  const navigate = useNavigate();
  const { messages, setMessages } = useAgent();

  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [toolCount, setToolCount] = useState(null);
  const [attachments, setAttachments] = useState([]);
  // 首页可能先于浮窗挂载，初始化时补读一次共享上下文
  const [field, setField] = useState(() => getFieldContext());

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);
  const liveRef = useRef({ content: '', timer: null });

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    if (liveRef.current.timer) clearTimeout(liveRef.current.timer);
  }, []);

  useEffect(() => {
    agentApi.status().then(setStatus).catch(() => setStatus({ configured: false }));
    agentApi.tools().then((tools) => setToolCount(tools.length)).catch(() => {});
  }, []);

  // 首页选中的地块作为对话上下文（仅本地，不上报）
  useEffect(() => {
    const onField = (event) => setField(event.detail);
    window.addEventListener('wentin:field', onField);
    return () => window.removeEventListener('wentin:field', onField);
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const jump = () => { list.scrollTop = list.scrollHeight; };
    jump();
    const raf = requestAnimationFrame(jump);
    const timer = setTimeout(jump, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [messages, loading, analyzing, collapsed]);

  const updateStreaming = (updater) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === 'assistant' && next[i].streaming) {
          next[i] = updater(next[i]);
          break;
        }
      }
      return next;
    });
  };

  const flushLive = () => {
    const live = liveRef.current;
    live.timer = null;
    updateStreaming((m) => ({ ...m, liveContent: live.content }));
  };

  const scheduleFlush = () => {
    if (liveRef.current.timer) return;
    liveRef.current.timer = setTimeout(flushLive, 60);
  };

  const clearLive = () => {
    const live = liveRef.current;
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    live.content = '';
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    const files = attachments.map((item) => item.file);
    const previews = attachments.map((item) => item.preview);
    const notConfigured = status && status.configured === false;
    if ((!content && files.length === 0) || loading || notConfigured) return;

    const question = content || '请看看这些作物照片，帮我判断植物种类、生长阶段和健康状况。';
    // 和完整对话页保持一致：图片识别结果随历史带上，后续追问仍能参考
    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => ({
        role: m.role,
        content: m.role === 'user' && m.vision
          ? `${m.content}\n\n【图片识别结果（视觉模型提供，供参考）】\n${formatVision(m.vision)}`
          : m.content,
      }));

    // 只把地块上下文拼进发给模型的文本，气泡里保持用户原话
    const outbound = field
      ? `【当前地块：${field.name}（ID ${field.id}）${field.cropName ? `，作物：${field.cropName}` : ''}】\n${question}`
      : question;

    setError('');
    setInput('');
    setAttachments([]);
    clearLive();
    setMessages((prev) => [...prev, { role: 'user', content: question, images: previews }]);
    setLoading(true);

    try {
      let vision = null;
      let visionContext = '';

      if (files.length > 0) {
        setAnalyzing(true);
        vision = await agentApi.vision(files, content);
        visionContext = formatVision(vision);
        setMessages((prev) => prev.map((m, index) => (
          index === prev.length - 1 ? { ...m, vision } : m
        )));
        setAnalyzing(false);
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '',
        thoughts: [],
        toolCalls: [],
        streaming: true,
      }]);

      const done = await agentApi.chatStream(outbound, history, visionContext, {
        onContentDelta: ({ delta }) => {
          liveRef.current.content += delta;
          scheduleFlush();
        },
        onThought: ({ round, content: thought }) => {
          updateStreaming((m) => ({
            ...m,
            thoughts: [...(m.thoughts || []), { round, content: thought }],
          }));
        },
        onToolStarted: ({ round, tool, arguments: args }) => {
          updateStreaming((m) => ({
            ...m,
            toolCalls: [...(m.toolCalls || []), {
              round, tool, arguments: args, resultSummary: '', elapsedMs: null,
            }],
          }));
        },
        onToolFinished: ({ round, tool, arguments: args, resultSummary, elapsedMs }) => {
          updateStreaming((m) => {
            const calls = [...(m.toolCalls || [])];
            let index = -1;
            for (let i = calls.length - 1; i >= 0; i -= 1) {
              if (calls[i].round === round && calls[i].tool === tool && calls[i].elapsedMs == null) {
                index = i;
                break;
              }
            }
            if (index >= 0) {
              calls[index] = { ...calls[index], resultSummary, elapsedMs };
            } else {
              calls.push({ round, tool, arguments: args, resultSummary, elapsedMs });
            }
            return { ...m, toolCalls: calls };
          });
        },
      });

      clearLive();
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i].streaming) {
            next[i] = {
              role: 'assistant',
              content: done.reply,
              toolCalls: done.toolCalls || [],
              thoughts: done.thoughts || [],
              truncated: done.truncated,
              streaming: false,
            };
            break;
          }
        }
        return next;
      });
    } catch (e) {
      clearLive();
      setError(e.message || '调用失败');
      setMessages((prev) => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === 'assistant'
          && next[next.length - 1].streaming) {
          next.pop();
        }
        if (next.length > 0 && next[next.length - 1].role === 'user') {
          next.pop();
        }
        return next;
      });
      setInput(content);
      if (files.length > 0) {
        setAttachments(files.map((file, index) => ({ file, preview: previews[index] })));
      }
    } finally {
      clearLive();
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const handleFiles = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (picked.length === 0) return;
    if (attachments.length + picked.length > MAX_IMAGES) {
      setError(`一次最多识别 ${MAX_IMAGES} 张照片`);
      return;
    }
    setError('');
    const prepared = [];
    for (const file of picked) {
      try {
        const compressed = await compressImage(file);
        prepared.push({ file: compressed, preview: URL.createObjectURL(compressed) });
      } catch (e) {
        setError(e.message);
      }
    }
    if (prepared.length > 0) {
      setAttachments((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES));
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearChat = () => {
    messages.forEach((m) => (m.images || []).forEach((url) => URL.revokeObjectURL(url)));
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    setAttachments([]);
    setMessages([]);
    setError('');
  };

  const notConfigured = status && status.configured === false;
  const canSend = !loading && !notConfigured && (input.trim().length > 0 || attachments.length > 0);

  if (collapsed) {
    return (
      <button
        type="button"
        className="agent-dock-tab"
        onClick={() => setCollapsed(false)}
        title="打开助农手"
      >
        <span className="agent-dock-tab-icon">🤖</span>
        <span className="agent-dock-tab-text">助农手</span>
      </button>
    );
  }

  return (
    <aside className="agent-dock glass-heavy">
      <header className="agent-dock-head">
        <div className="agent-dock-avatar">🤖</div>
        <div className="agent-dock-id">
          <div className="agent-dock-title">
            助农手
            <span className="agent-dock-tag">AI</span>
          </div>
          <div className={`agent-dock-status ${notConfigured ? 'off' : ''}`}>
            <span className="agent-dock-live" />
            {notConfigured
              ? '未启用 · 缺少 API Key'
              : `在线 · 已接入 ${toolCount ?? 7} 项农事工具`}
          </div>
        </div>
        {messages.length > 0 && (
          <button type="button" className="agent-dock-icon" onClick={clearChat} title="清空对话">
            🗑
          </button>
        )}
        <button
          type="button"
          className="agent-dock-icon"
          onClick={() => navigate('/agent')}
          title="打开完整对话"
        >
          ⤢
        </button>
        <button
          type="button"
          className="agent-dock-icon"
          onClick={() => setCollapsed(true)}
          title="收起面板"
        >
          ×
        </button>
      </header>

      <div className="agent-dock-body" ref={listRef}>
        {field && (
          <div className="agent-dock-context">
            📍 当前地块 · {field.name}
            {field.cropName ? ` ${field.cropName}` : ''}
          </div>
        )}

        {messages.length === 0 && (
          <div className="agent-dock-welcome">
            <div className="agent-dock-welcome-icon">🌾</div>
            <h3>你好，我是助农手</h3>
            <p>可以问地块、天气和农事安排，也可以直接上传作物照片。</p>
            <div className="agent-dock-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
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
          <div key={i} className={`agent-dock-msg ${m.role}`}>
            {m.images?.length > 0 && (
              <div className="agent-dock-images">
                {m.images.map((src) => (
                  <img key={src} src={src} alt="上传的作物照片" />
                ))}
              </div>
            )}

            {m.role === 'user' && (
              <>
                <div className="agent-dock-bubble user">{m.content}</div>
                {m.vision && (
                  <div className="agent-dock-vision">
                    🔎 {m.vision.plantName || '未识别'}
                    {' · '}{m.vision.growthStage || '阶段未知'}
                    {' · '}{m.vision.healthStatus || '状态未知'}
                  </div>
                )}
              </>
            )}

            {m.role === 'assistant' && (
              <>
                {m.toolCalls?.length > 0 && (
                  <div className="agent-dock-tools">
                    {m.toolCalls.map((call, index) => {
                      const meta = TOOL_LABELS[call.tool] || { icon: '🔧', label: call.tool };
                      return (
                        <span
                          className={`agent-dock-tool ${call.elapsedMs == null ? 'running' : ''}`}
                          key={`${call.tool}-${index}`}
                          title={call.resultSummary || ''}
                        >
                          <span className="agent-dock-tool-check">
                            {call.elapsedMs == null ? '·' : '✓'}
                          </span>
                          {meta.label}
                          <em>{call.elapsedMs == null ? '进行中' : `${call.elapsedMs}ms`}</em>
                        </span>
                      );
                    })}
                  </div>
                )}

                {m.streaming && !m.liveContent && (
                  <div className="agent-dock-thinking">
                    <span className="agent-dot" />
                    <span className="agent-dot" />
                    <span className="agent-dot" />
                    <span>{analyzing ? '正在识别作物照片…' : '正在查阅数据…'}</span>
                  </div>
                )}

                {m.streaming && m.liveContent && (
                  <div className="agent-dock-bubble bot live">{m.liveContent}</div>
                )}

                {!m.streaming && m.content && (
                  <div className="agent-dock-bubble bot">
                    <Markdown>{m.content}</Markdown>
                  </div>
                )}

                {m.truncated && (
                  <div className="agent-dock-note">
                    回答可能不完整（达到工具调用轮数上限），可以把问题问得更具体。
                  </div>
                )}

                {i === messages.length - 1 && !m.streaming && messages.length > 0 && (
                  <div className="agent-dock-suggestions compact">
                    {SUGGESTIONS.slice(1).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        disabled={loading || notConfigured}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {notConfigured && (
          <div className="agent-dock-warning">
            助农手尚未启用：后端没有配置 <code>DEEPSEEK_API_KEY</code>。
          </div>
        )}
      </div>

      {error && <div className="agent-dock-error">{error}</div>}

      {attachments.length > 0 && (
        <div className="agent-dock-attachments">
          {attachments.map((item, index) => (
            <div className="agent-dock-attach" key={item.preview}>
              <img src={item.preview} alt={`待上传照片 ${index + 1}`} />
              <button type="button" onClick={() => removeAttachment(index)} aria-label="移除照片">×</button>
            </div>
          ))}
          <span>最多 {MAX_IMAGES} 张</span>
        </div>
      )}

      <footer className="agent-dock-composer">
        <div className="agent-dock-input-box">
          <textarea
            rows={1}
            placeholder="问问地块、天气，或上传作物照片…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading || notConfigured}
          />
          <div className="agent-dock-tools-row">
            <button
              type="button"
              className="agent-dock-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || notConfigured}
              title="上传作物照片"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFiles}
            />
            <button
              type="button"
              className="agent-dock-send"
              onClick={() => send()}
              disabled={!canSend}
              title="发送"
            >
              {analyzing ? '识别中' : loading ? '…' : '↑'}
            </button>
          </div>
        </div>
        <p className="agent-dock-disclaimer">内容由 AI 生成，仅供参考</p>
      </footer>
    </aside>
  );
}