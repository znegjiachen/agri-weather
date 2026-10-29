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

const DOCK_WIDTH_KEY = 'wentin:dockWidth';
const DOCK_DEFAULT_WIDTH = 360;
const DOCK_MIN_WIDTH = 300;
const DOCK_MAX_WIDTH = 600;

function clampDockWidth(value) {
  // 给左侧主内容至少留 400px，避免在 1200 附近把驾驶舱挤扁
  const available = typeof window !== 'undefined' ? window.innerWidth - 240 - 400 : DOCK_MAX_WIDTH;
  const max = Math.min(DOCK_MAX_WIDTH, Math.max(DOCK_MIN_WIDTH, available));
  return Math.min(max, Math.max(DOCK_MIN_WIDTH, value));
}

/**
 * 桌面端常驻的助农手浮窗。
 *
 * 与 /agent 共用 AgentContext 里的 messages，所以两边看到的是同一段对话；
 * 这里做紧凑版渲染（工具轨迹 + 回答），照片识别结果用一行摘要展示。
 */
export default function AgentDock() {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(DOCK_WIDTH_KEY));
    return clampDockWidth(Number.isFinite(saved) && saved > 0 ? saved : DOCK_DEFAULT_WIDTH);
  });
  const [resizing, setResizing] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [toolCount, setToolCount] = useState(null);
  const [attachments, setAttachments] = useState([]);
  // 首页可能先于浮窗挂载，初始化时补读一次共享上下文
  const [field, setField] = useState(() => getFieldContext());

  // 一块地一个智能体 → 一个独立会话；没有 agentId 时用地块 ID 兜底
  const agentKey = field?.agentId
    ? String(field.agentId)
    : field?.id ? `field-${field.id}` : 'default';
  const { messages, setMessages, clearMessages } = useAgent(agentKey);

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

  // 记住用户拖拽后的宽度
  useEffect(() => {
    localStorage.setItem(DOCK_WIDTH_KEY, String(width));
  }, [width]);

  // 窗口变窄时把面板收回到允许范围内
  useEffect(() => {
    const onResize = () => setWidth((w) => clampDockWidth(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startResize = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    setResizing(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMove = (moveEvent) => {
      // 面板贴在右侧：向左拖变宽，向右拖变窄
      setWidth(clampDockWidth(startWidth + (startX - moveEvent.clientX)));
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleResizeKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setWidth((w) => clampDockWidth(w + 24));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setWidth((w) => clampDockWidth(w - 24));
    }
  };

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

      const done = await agentApi.chatStream(question, history, visionContext, {
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
      }, { agentId: field?.agentId, farmlandId: field?.id });

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
              knowledgeUsed: done.knowledgeUsed || [],
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
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    setAttachments([]);
    clearMessages();
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
    <aside
      className={`agent-dock glass-heavy ${resizing ? 'resizing' : ''}`}
      style={{ width, flexBasis: width }}
    >
      <div
        className="agent-dock-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="拖动调整助农手面板宽度"
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={handleResizeKeyDown}
        onDoubleClick={() => setWidth(DOCK_DEFAULT_WIDTH)}
        title="拖动调整宽度，双击恢复默认"
      />
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
          onClick={() => navigate(field?.agentId ? `/agent/chat?agentId=${field.agentId}` : '/agent/chat')}
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

                {!m.streaming && m.knowledgeUsed?.length > 0 && (
                  <div className="agent-dock-refs">
                    📚 参考知识：{m.knowledgeUsed.map((ref) => ref.title).join('、')}
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