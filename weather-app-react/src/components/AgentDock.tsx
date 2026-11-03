import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Markdown from 'react-markdown';
import { agent as agentApi } from '../api';
import { useAgentHistory } from '../hooks/useAgentHistory';
import { useVoiceInput } from '../hooks/useVoiceInput';
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
export default function AgentDock({ defaultCollapsed = false }) {
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(defaultCollapsed);
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
  const [docAttachments, setDocAttachments] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  // 首页可能先于浮窗挂载，初始化时补读一次共享上下文
  const [field, setField] = useState(() => getFieldContext());

  // 一块地一个智能体 → 一个独立会话，并从后端恢复历史
  const {
    messages,
    setMessages,
    clearHistory,
    loading: historyLoading,
    error: historyError,
    retry: retryHistory,
  } = useAgentHistory(field?.agentId);

  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);
  const liveRef = useRef({ content: '', timer: null });
  const abortRef = useRef(null);
  const [statusError, setStatusError] = useState(false);

  const voice = useVoiceInput({
    asrConfigured: status?.asrConfigured,
    onText: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
    onError: setError,
  });

  // 窗口缩到窄屏时自动收起，避免浮窗把主内容挤扁；放大后不强制展开
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1599px)');
    const onChange = (event) => {
      if (event.matches) setCollapsed(true);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    if (liveRef.current.timer) clearTimeout(liveRef.current.timer);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    let alive = true;
    agentApi.status()
      .then((data) => { if (alive) { setStatus(data); setStatusError(false); } })
      .catch(() => { if (alive) setStatusError(true); });
    agentApi.tools().then((tools) => { if (alive) setToolCount(tools.length); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const retryStatus = () => {
    setStatusError(false);
    agentApi.status()
      .then((data) => { setStatus(data); setStatusError(false); })
      .catch(() => setStatusError(true));
  };

  const stopGeneration = () => abortRef.current?.abort();

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

  const send = async (text = undefined) => {
    const content = (text ?? input).trim();
    const files = attachments.map((item) => item.file);
    const previews = attachments.map((item) => item.preview);
    const docsForTurn = docAttachments;
    const notConfigured = !statusError && status && status.configured === false;
    if ((!content && files.length === 0 && docsForTurn.length === 0)
      || loading || historyLoading || notConfigured) return;

    const question = content || (files.length > 0
      ? '请看看这些作物照片，帮我判断植物种类、生长阶段和健康状况。'
      : '请阅读这些文档，提取与当前地块相关的农事建议。');
    // 历史里只保留文档名；当前引用的文档通过 documentIds 走后端检索
    const history = messages
      .filter((m) => !m.streaming)
      .map((m) => {
        const parts = [];
        const docs = m.documents || (m.document ? [m.document] : []);
        if (m.role === 'user' && docs.length > 0) {
          parts.push(`【用户上传了文档：${docs.map((doc) => doc.filename).join('、')}】`);
        }
        if (m.role === 'user' && m.vision) {
          parts.push(`【图片识别结果（视觉模型提供，供参考）】\n${formatVision(m.vision)}`);
        }
        parts.push(m.content);
        return { role: m.role, content: parts.filter(Boolean).join('\n\n') };
      });

    setError('');
    setInput('');
    setAttachments([]);
    clearLive();
    setMessages((prev) => [...prev, {
      role: 'user',
      content: question,
      images: previews,
      documents: docsForTurn,
      document: docsForTurn[0] || null,
    }]);
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let vision = null;
      let visionContext = '';

      if (files.length > 0) {
        setAnalyzing(true);
        vision = await agentApi.vision(files, content);
        if (controller.signal.aborted) {
          throw new DOMException('用户已停止生成', 'AbortError');
        }
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
        signal: controller.signal,
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
      }, {
        agentId: field?.agentId,
        farmlandId: field?.id,
        visionJson: vision ? JSON.stringify(vision) : null,
        documentId: docsForTurn[0]?.documentId,
        documentIds: docsForTurn.map((doc) => doc.documentId).filter(Boolean),
        documentName: docsForTurn.map((doc) => doc.filename).join('、'),
        documentContext: docsForTurn.some((doc) => doc.documentId)
          ? undefined
          : docsForTurn.map((doc) => doc.text).filter(Boolean).join('\n\n'),
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
      const aborted = e.name === 'AbortError' || controller.signal.aborted;
      const partial = liveRef.current.content;
      clearLive();

      if (aborted) {
        setError('已停止生成');
        setMessages((prev) => {
          const next = [...prev];
          if (next.length > 0 && next[next.length - 1].role === 'assistant'
            && next[next.length - 1].streaming) {
            if (partial.trim()) {
              next[next.length - 1] = {
                role: 'assistant',
                content: `${partial.trim()}\n\n（已停止生成）`,
                toolCalls: next[next.length - 1].toolCalls || [],
                thoughts: next[next.length - 1].thoughts || [],
                streaming: false,
              };
            } else {
              next.pop();
            }
          }
          return next;
        });
      } else {
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
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
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

  const handleDocument = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) {
      setError('对话文档支持 TXT、Markdown、PDF、Word');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('文档不能超过 5MB');
      return;
    }
    setDocLoading(true);
    setError('');
    try {
      const data = await agentApi.document(file);
      const attachment = {
        documentId: data.id,
        filename: data.filename || file.name,
        preview: data.preview || '',
        charCount: data.charCount,
        chunkCount: data.chunkCount,
        truncated: data.truncated,
      };
      if (docAttachments.length >= 3
        && !docAttachments.some((doc) => doc.documentId === attachment.documentId)) {
        setError('最多同时引用 3 份文档');
      } else {
        setDocAttachments((prev) => [
          ...prev.filter((doc) => doc.documentId !== attachment.documentId),
          attachment,
        ].slice(-3));
      }
    } catch (e) {
      setError(e.message || '文档解析失败');
    } finally {
      setDocLoading(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const restoreDocument = (doc) => {
    if (!doc?.documentId) return;
    const attachment = {
      documentId: doc.documentId,
      filename: doc.filename,
      charCount: doc.charCount || 0,
      chunkCount: doc.chunkCount || 0,
      truncated: false,
      preview: doc.preview || '',
    };
    setDocAttachments((prev) => [
      ...prev.filter((item) => item.documentId !== attachment.documentId),
      attachment,
    ].slice(-3));
  };

  const removeDocument = (documentId) => {
    setDocAttachments((prev) => prev.filter((doc) => doc.documentId !== documentId));
  };

  const clearChat = () => {
    if (!window.confirm('清空后对话记录无法恢复，确定清空吗？')) return;
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    setAttachments([]);
    setDocAttachments([]);
    clearHistory();
    setError('');
  };

  const notConfigured = !statusError && status && status.configured === false;
  const canSend = !loading && !historyLoading && !notConfigured
    && (input.trim().length > 0 || attachments.length > 0 || docAttachments.length > 0);

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
            {field?.agentName || '助农手'}
            <span className="agent-dock-tag">AI</span>
          </div>
          <button
            type="button"
            className={`agent-dock-status ${notConfigured ? 'off' : ''} ${statusError ? 'error' : ''}`}
            onClick={statusError ? retryStatus : undefined}
            title={statusError ? '点击重新检查状态' : undefined}
          >
            <span className="agent-dock-live" />
            {statusError
              ? '状态获取失败 · 点击重试'
              : notConfigured
                ? '未启用 · 缺少 API Key'
                : `在线 · 已接入 ${toolCount ?? 7} 项农事工具`}
          </button>
        </div>
        {messages.length > 0 && (
          <button type="button" className="agent-dock-icon" onClick={clearChat} title="清空对话" aria-label="清空对话">
            🗑️
          </button>
        )}
        <button
          type="button"
          className="agent-dock-icon"
          onClick={() => navigate(field?.agentId ? `/agent/chat?agentId=${field.agentId}` : '/agent/chat')}
          title="打开完整对话"
          aria-label="打开完整对话"
        >
          ⤢
        </button>
        <button
          type="button"
          className="agent-dock-icon"
          onClick={() => setCollapsed(true)}
          title="收起面板"
          aria-label="收起面板"
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

        {historyError && (
          <div className="agent-dock-warning" role="status">
            对话历史加载失败：{historyError}
            <button type="button" className="agent-dock-retry" onClick={retryHistory}>重试</button>
          </div>
        )}

        {messages.length === 0 && historyLoading && (
          <p className="empty-text">正在加载对话历史…</p>
        )}

        {messages.length === 0 && !historyLoading && (
          <div className="agent-dock-welcome">
            <div className="agent-dock-welcome-icon">🌾</div>
            <h3>你好，我是助农手</h3>
            <p>可以问地块、天气和农事安排，也可以上传作物照片或种植方案文档。</p>
            <div className="agent-dock-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={loading || historyLoading || notConfigured}
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
                {(m.documents?.length ? m.documents : m.document ? [m.document] : []).map((doc, docIndex) => (
                  doc.documentId ? (
                    <button
                      type="button"
                      key={doc.documentId || docIndex}
                      className="agent-dock-doc-chip clickable"
                      onClick={() => restoreDocument(doc)}
                      title="点击继续参考该文档"
                    >
                      📄 {doc.filename}
                    </button>
                  ) : (
                    <div className="agent-dock-doc-chip" key={docIndex}>📄 {doc.filename}</div>
                  )
                ))}
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
                        disabled={loading || historyLoading || notConfigured}
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

        {statusError && (
          <div className="agent-dock-warning">
            无法获取助农手状态，可能是网络问题，仍可继续提问。
            <button type="button" className="agent-dock-retry" onClick={retryStatus}>重试</button>
          </div>
        )}

        {notConfigured && (
          <div className="agent-dock-warning">
            助农手尚未启用：后端没有配置 <code>DEEPSEEK_API_KEY</code>。
          </div>
        )}
      </div>

      {error && <div className="agent-dock-error">{error}</div>}

      {docAttachments.length > 0 && (
        <div className="agent-dock-doc-list">
          {docAttachments.map((doc) => (
            <div className="agent-dock-doc" key={doc.documentId || doc.filename} title={doc.preview || ''}>
              <span>📄 {doc.filename}</span>
              <small>
                {doc.chunkCount
                  ? `${doc.charCount} 字 · ${doc.chunkCount} 段`
                  : '已建立索引'}
                {doc.truncated ? ' · 部分索引' : ''}
              </small>
              <button
                type="button"
                onClick={() => removeDocument(doc.documentId)}
                aria-label={`移除文档 ${doc.filename}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {docLoading && <div className="agent-dock-doc loading">正在解析文档…</div>}

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
            placeholder="问问地块、天气，或上传照片/文档…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={loading || historyLoading || notConfigured}
          />
          <div className="agent-dock-tools-row">
            <button
              type="button"
              className="agent-dock-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || historyLoading || notConfigured}
              title="上传作物照片"
              aria-label="上传作物照片"
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
              className={`agent-dock-tool-btn ${voice.recording ? 'recording' : ''}`}
              onClick={voice.toggle}
              disabled={loading || historyLoading || voice.processing || notConfigured || !voice.supported}
              title={
                !voice.supported ? '当前浏览器不支持语音输入，请改用文字'
                  : voice.recording ? '结束并识别'
                    : voice.processing ? '正在识别…'
                      : status?.asrConfigured ? '语音输入'
                        : '浏览器语音输入（需联网）'
              }
              aria-label={voice.recording ? '结束并识别' : '语音输入'}
            >
              {voice.processing ? '⏳' : voice.recording ? '⏹' : '🎤'}
            </button>
            <button
              type="button"
              className="agent-dock-tool-btn"
              onClick={() => docInputRef.current?.click()}
              disabled={loading || historyLoading || notConfigured || docLoading}
              title="上传文档（PDF / Word / TXT / Markdown）"
              aria-label="上传文档"
            >
              📄
            </button>
            <input
              ref={docInputRef}
              type="file"
              accept=".txt,.md,.markdown,.pdf,.doc,.docx"
              hidden
              onChange={handleDocument}
            />
            {loading && (
              <button
                type="button"
                className="agent-dock-stop"
                onClick={stopGeneration}
                title="停止生成"
                aria-label="停止生成"
              >
                ⏹
              </button>
            )}
            <button
              type="button"
              className="agent-dock-send"
              onClick={() => send()}
              disabled={!canSend}
              title="发送"
              aria-label="发送"
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