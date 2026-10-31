import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { agent as agentApi, agents as agentsApi } from '../api';
import { useAgentHistory } from '../hooks/useAgentHistory';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { MAX_IMAGES, compressImage } from '../utils/image';
import { formatVision } from '../utils/agentVision';
import { TOOL_LABELS } from '../utils/agentTools';

const SUGGESTIONS = [
  '我那块地明天适合打药吗？',
  '未来一周哪天适合施肥？',
  '我的作物现在处于什么生长阶段？',
  '最近有冻害或涝害风险吗？',
];

/**
 * 助农手（问田农事顾问）对话页。
 *
 * messages 由 App 持有并传入 —— 本组件是条件渲染的，切板块时会被卸载，
 * 状态放在这里会随组件一起丢失。草稿、附件、加载状态留在本地。
 */
export default function AgentPage() {
  const [searchParams] = useSearchParams();
  const queryAgentId = Number(searchParams.get('agentId')) || null;

  const [agents, setAgents] = useState([]);
  const [manualAgentId, setSelectedId] = useState(null);
  const selectedId = useMemo(() => {
    if (manualAgentId && agents.some((item) => item.id === manualAgentId)) return manualAgentId;
    if (queryAgentId && agents.some((item) => item.id === queryAgentId)) return queryAgentId;
    return agents[0]?.id ?? null;
  }, [agents, manualAgentId, queryAgentId]);
  const selectedAgent = useMemo(
    () => agents.find((item) => item.id === selectedId) || null,
    [agents, selectedId],
  );

  // 一个智能体一个会话；切换时从后端恢复历史（刷新页面也不丢）
  const {
    messages,
    setMessages,
    clearHistory,
    loading: historyLoading,
  } = useAgentHistory(selectedId);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [docAttachment, setDocAttachment] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);

  const voice = useVoiceInput({
    asrConfigured: status?.asrConfigured,
    onText: (text) => setInput((prev) => (prev ? `${prev} ${text}` : text)),
    onError: setError,
  });

  const liveRef = useRef({ thought: '', content: '', round: null, timer: null });

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // 离开页面时只清理还没发出去的照片和流式缓冲
  useEffect(() => () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    if (liveRef.current.timer) clearTimeout(liveRef.current.timer);
  }, []);

  useEffect(() => {
    agentApi.status()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));

    let alive = true;
    agentsApi.list()
      .then((data) => { if (alive) setAgents(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 首次进入 / 从其它 Tab 切回来 / 新消息到达时，直接定位到最新一条
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
  }, [messages, loading, analyzing]);

  const updateStreamingMessage = (updater) => {
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

  const clearLiveBuffer = () => {
    const live = liveRef.current;
    if (live.timer) clearTimeout(live.timer);
    live.timer = null;
    live.thought = '';
    live.content = '';
  };

  const flushLive = () => {
    const live = liveRef.current;
    live.timer = null;
    updateStreamingMessage((m) => ({
      ...m,
      liveThought: live.thought,
      liveContent: live.content,
      liveThoughtRound: live.round,
    }));
  };

  const scheduleLiveFlush = () => {
    if (liveRef.current.timer) return;
    liveRef.current.timer = setTimeout(flushLive, 50);
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    const files = attachments.map((item) => item.file);
    const previews = attachments.map((item) => item.preview);
    const docForTurn = docAttachment;
    if ((!content && files.length === 0 && !docForTurn) || loading || historyLoading || notConfigured) return;

    const question = content || (files.length > 0
      ? '请看看这些作物照片，帮我判断植物种类、生长阶段和健康状况。'
      : '请阅读这份文档，提取与当前地块相关的农事建议。');
    setError('');
    setInput('');
    setAttachments([]);

    // 历史里把之前的图片识别结果 / 文档名称带上，后续追问时模型仍能参考
    const history = messages.map((m) => {
      const parts = [];
      if (m.role === 'user' && m.document) parts.push(`【用户上传了文档：${m.document.filename}】`);
      if (m.role === 'user' && m.vision) {
        parts.push(`【图片识别结果（视觉模型提供，供参考）】\n${formatVision(m.vision)}`);
      }
      parts.push(m.content);
      return { role: m.role, content: parts.filter(Boolean).join('\n\n') };
    });

    clearLiveBuffer();
    liveRef.current.round = null;
    setMessages((prev) => [...prev, { role: 'user', content: question, images: previews, document: docForTurn }]);
    setLoading(true);

    try {
      let vision = null;
      let visionContext = '';

      if (files.length > 0) {
        setAnalyzing(true);
        vision = await agentApi.vision(files, content);
        visionContext = formatVision(vision);
        // 识别结果先挂到本轮用户消息上，用户能立刻看到
        setMessages((prev) => prev.map((m, index) => (
          index === prev.length - 1 ? { ...m, vision } : m
        )));
        setAnalyzing(false);
      }

      // 先占位一条助手消息，SSE 的思考/工具事件会实时填进工作轨迹
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '',
        thoughts: [],
        toolCalls: [],
        streaming: true,
      }]);

      const done = await agentApi.chatStream(question, history, visionContext, {
        onRound: ({ round }) => {
          clearLiveBuffer();
          liveRef.current.round = round;
          updateStreamingMessage((m) => ({
            ...m,
            currentRound: round,
            liveThought: '',
            liveContent: '',
            liveThoughtRound: round,
          }));
        },
        onReasoningDelta: ({ round, delta }) => {
          liveRef.current.round = round;
          liveRef.current.thought += delta;
          scheduleLiveFlush();
        },
        onContentDelta: ({ round, delta }) => {
          liveRef.current.round = round;
          liveRef.current.content += delta;
          scheduleLiveFlush();
        },
        onThought: ({ round, content: thought }) => {
          clearLiveBuffer();
          updateStreamingMessage((m) => ({
            ...m,
            thoughts: [...m.thoughts, { round, content: thought }],
            liveThought: '',
            liveThoughtRound: null,
          }));
        },
        onToolStarted: ({ round, tool, arguments: args }) => {
          updateStreamingMessage((m) => ({
            ...m,
            toolCalls: [...m.toolCalls, {
              round,
              tool,
              arguments: args,
              resultSummary: '',
              elapsedMs: null,
            }],
          }));
        },
        onToolFinished: ({ round, tool, arguments: args, resultSummary, elapsedMs }) => {
          updateStreamingMessage((m) => {
            const calls = [...m.toolCalls];
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
        agentId: selectedId,
        farmlandId: selectedAgent?.farmlandId,
        visionJson: vision ? JSON.stringify(vision) : null,
        documentName: docForTurn?.filename,
        documentContext: docForTurn?.text,
      });
      setDocAttachment(null);

      clearLiveBuffer();
      setLoading(false);
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
              rounds: done.rounds,
              truncated: done.truncated,
              streaming: false,
            };
            break;
          }
        }
        return next;
      });
    } catch (e) {
      clearLiveBuffer();
      setError(e.message || '调用失败');
      // 失败时移除占位消息和本轮用户消息，保留输入与照片方便重试
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
      clearLiveBuffer();
      setAnalyzing(false);
      setLoading(false);
      inputRef.current?.focus();
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
      setDocAttachment({
        filename: file.name,
        text: data.text,
        charCount: data.charCount,
        truncated: data.truncated,
      });
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    clearLiveBuffer();
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    setAttachments([]);
    clearHistory();
    setError('');
  };

  const notConfigured = status && status.configured === false;
  const canSend = !loading && !historyLoading && !notConfigured && (input.trim().length > 0 || attachments.length > 0 || !!docAttachment);

  return (
    <div className="agent-page">
      <div className="page-header agent-page-head">
        <div className="agent-page-heading">
          <h2 className="page-title">🤖 {selectedAgent ? selectedAgent.name : '问田 · 助农手'}</h2>
          <p className="agent-page-sub">
            {selectedAgent
              ? `${selectedAgent.farmlandName || ''}${selectedAgent.cropName ? ` · ${selectedAgent.cropName}` : ''} · 内容由 AI 生成，仅供参考`
              : '内容由 AI 生成，仅供参考'}
          </p>
        </div>
        <div className="agent-page-actions">
          {agents.length > 0 && (
            <select
              className="agent-switcher"
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              disabled={loading}
              aria-label="切换助农手"
            >
              {agents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.cropName ? ` · ${item.cropName}` : ''}
                </option>
              ))}
            </select>
          )}
          {messages.length > 0 && (
            <button className="btn-cancel" onClick={clearChat} style={{ padding: '8px 16px', fontSize: 13 }}>
              🗑 清空对话
            </button>
          )}
        </div>
      </div>

      {notConfigured && (
        <div className="agent-warning">
          <strong>⚠️ 助农手尚未启用</strong>
          <p>
            后端没有配置 DeepSeek API Key。请设置环境变量
            <code>DEEPSEEK_API_KEY</code> 后重启服务。
            图片识别默认复用同一个 Key，也可以单独设置 <code>VISION_API_KEY</code>。
          </p>
        </div>
      )}

      <div className="agent-window glass">
        <div className="agent-messages" ref={listRef}>
          {messages.length === 0 && historyLoading && (
            <p className="empty-text">正在加载对话历史…</p>
          )}

          {messages.length === 0 && !historyLoading && (
            <div className="agent-welcome">
              <div className="agent-welcome-icon">{selectedAgent?.avatar || '🌾'}</div>
              <h3>你好，我是{selectedAgent?.name || '助农手'}</h3>
              <p>
                {selectedAgent?.welcome
                  || '可以问地块、天气和农事安排，也可以直接上传作物照片，我帮你看植物种类、生长阶段和病害。'}
              </p>

              <div className="agent-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="agent-suggestion"
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
            <div key={i} className={`agent-msg agent-msg-${m.role}`}>
              <div className="agent-avatar">{m.role === 'user' ? '👨‍🌾' : '🤖'}</div>
              <div className="agent-bubble-wrap">
                {m.images?.length > 0 && (
                  <div className="agent-msg-images">
                    {m.images.map((src) => (
                      <img key={src} src={src} alt="上传的作物照片" />
                    ))}
                  </div>
                )}

                {m.document && (
                  <div className="agent-doc-chip">📄 {m.document.filename}</div>
                )}

                {m.role === 'assistant' && m.streaming
                  && !(m.thoughts?.length > 0) && !(m.toolCalls?.length > 0)
                  && !m.liveThought && !m.liveContent && (
                    <div className="agent-bubble agent-thinking">
                      <span className="agent-dot" />
                      <span className="agent-dot" />
                      <span className="agent-dot" />
                      <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                        正在思考…
                      </span>
                    </div>
                  )}

                {m.role === 'assistant' && (
                  m.thoughts?.length > 0 || m.toolCalls?.length > 0 || m.liveThought
                ) && (
                  <AgentWorkTrace
                    thoughts={m.thoughts || []}
                    calls={m.toolCalls || []}
                    liveThought={m.liveThought}
                    liveThoughtRound={m.liveThoughtRound}
                    liveContent={m.liveContent}
                    streaming={m.streaming}
                    currentRound={m.currentRound}
                    defaultOpen={i === messages.length - 1}
                  />
                )}

                {m.streaming && m.liveContent && (
                  <div className="agent-bubble agent-live-answer">{m.liveContent}</div>
                )}

                {/* 助手回复按 Markdown 渲染；用户输入保持原文，避免被当成标记解析 */}
                {!m.streaming && (
                  <div className="agent-bubble">
                    {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                  </div>
                )}

                {m.vision && <VisionCard vision={m.vision} />}

                {!m.streaming && m.knowledgeUsed?.length > 0 && (
                  <div className="agent-knowledge-refs">
                    📚 参考知识：{m.knowledgeUsed.map((ref) => ref.title).join('、')}
                  </div>
                )}

                {m.truncated && (
                  <div className="agent-note">
                    回答可能不完整（已达到工具调用轮数上限），可以试着把问题问得更具体
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && !messages.some((m) => m.streaming) && (
            <div className="agent-msg agent-msg-assistant">
              <div className="agent-avatar">🤖</div>
              <div className="agent-bubble-wrap">
                <div className="agent-bubble agent-thinking">
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                  <span className="agent-dot" />
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                    {analyzing ? '正在识别作物照片…' : '正在查阅数据…'}
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

        {docAttachment && (
          <div className="agent-doc-attachment">
            <span>📄 {docAttachment.filename}</span>
            <small>
              {docAttachment.charCount} 字
              {docAttachment.truncated ? ' · 已截断' : ''}
            </small>
            <button type="button" onClick={() => setDocAttachment(null)} aria-label="移除文档">×</button>
          </div>
        )}

        {docLoading && <div className="agent-doc-attachment loading">正在解析文档…</div>}

        {attachments.length > 0 && (
          <div className="agent-attachments">
            {attachments.map((item, index) => (
              <div className="agent-attach-item" key={item.preview}>
                <img src={item.preview} alt={`待上传照片 ${index + 1}`} />
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  aria-label="移除这张照片"
                >
                  ×
                </button>
              </div>
            ))}
            <span className="agent-attach-hint">
              最多 {MAX_IMAGES} 张，可拍叶片正反面或整株
            </span>
          </div>
        )}

        <div className="agent-input-bar">
          <button
            type="button"
            className="agent-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || historyLoading || notConfigured}
            aria-label="上传作物照片"
            title="上传作物照片"
          >
            📷
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
            className={`agent-attach-btn ${voice.recording ? 'recording' : ''}`}
            onClick={voice.toggle}
            disabled={loading || historyLoading || voice.processing || notConfigured}
            aria-label="语音输入"
            title={voice.recording ? '停止录音' : '语音输入'}
          >
            {voice.processing ? '⏳' : voice.recording ? '⏹' : '🎤'}
          </button>
          <button
            type="button"
            className="agent-attach-btn"
            onClick={() => docInputRef.current?.click()}
            disabled={loading || historyLoading || notConfigured || docLoading}
            aria-label="上传文档"
            title="上传文档（PDF / Word / TXT / Markdown）"
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
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="你有什么想知道的，快来问问我"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || historyLoading || notConfigured}
          />
          <button
            className="btn-primary agent-send"
            onClick={() => send()}
            disabled={!canSend}
          >
            {analyzing ? '识别中' : loading ? '…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 图片识别结果卡片 */
function VisionCard({ vision }) {
  const [open, setOpen] = useState(false);
  const healthClass = vision.healthStatus?.includes('异常')
    ? 'warn'
    : vision.healthStatus === '健康' ? 'ok' : 'unknown';
  const undetermined = !vision.plantName
    || vision.plantName === '未识别'
    || vision.healthStatus === '无法判断';

  return (
    <div className="agent-vision-card">
      <div className="agent-vision-head">
        <span className="agent-vision-title">🔎 图片识别</span>
        <span className="agent-vision-tag">{vision.plantName || '未识别'}</span>
        <span className="agent-vision-tag">{vision.growthStage || '无法判断'}</span>
        <span className={`agent-vision-tag health-${healthClass}`}>
          {vision.healthStatus || '无法判断'}
        </span>
      </div>

      {vision.issues?.length > 0 ? (
        <div className="agent-vision-issues">
          {vision.issues.map((issue, index) => (
            <div key={index} className="agent-vision-issue">
              <div className="agent-vision-issue-head">
                <strong>{issue.name || '未知问题'}</strong>
                {typeof issue.confidence === 'number' && (
                  <span>{Math.round(issue.confidence * 100)}%</span>
                )}
              </div>
              {issue.symptoms && <p>症状：{issue.symptoms}</p>}
              {issue.suggestion && <p>建议：{issue.suggestion}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="agent-vision-clean">
          {undetermined ? '图片信息不足，无法判断病虫害情况。' : '未发现明显病害或虫害迹象。'}
        </p>
      )}

      {vision.overallAssessment && (
        <p className="agent-vision-summary">{vision.overallAssessment}</p>
      )}

      {vision.careAdvice?.length > 0 && (
        <>
          <button
            type="button"
            className="agent-vision-toggle"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '收起照护建议 ▲' : '查看照护建议 ▼'}
          </button>
          {open && (
            <ul className="agent-vision-advice">
              {vision.careAdvice.map((advice, index) => (
                <li key={index}>{advice}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** 工作轨迹：每轮思考 + 工具调用，按时间顺序展示 */
function AgentWorkTrace({
  thoughts = [],
  calls = [],
  liveThought = '',
  liveThoughtRound = null,
  liveContent = '',
  streaming = false,
  currentRound = null,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const rounds = [...new Set([
    ...thoughts.map((t) => t.round),
    ...calls.map((c) => c.round ?? 1),
  ])].sort((a, b) => a - b);

  if (rounds.length === 0 && !liveThought) return null;

  const summary = [
    thoughts.length > 0 ? `${thoughts.length} 次思考` : '',
    calls.length > 0 ? `${calls.length} 次工具调用` : '',
  ].filter(Boolean).join(' · ');

  const waitingForRound = streaming
    && currentRound
    && !liveThought
    && !liveContent
    && !thoughts.some((t) => t.round === currentRound)
    && !calls.some((c) => c.round === currentRound);

  return (
    <div className="agent-work">
      <button type="button" className="agent-work-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="agent-work-title">🧠 工作轨迹</span>
        <span className="agent-work-meta">{summary}</span>
        <span className="agent-work-caret">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {open && (
        <div className="agent-work-body">
          {thoughts.length === 0 && !liveThought && (
            <div className="agent-work-hint">
              当前模型未返回思考内容，以下为工具调用轨迹。
            </div>
          )}

          {rounds.map((round) => (
            <div className="agent-work-round" key={round}>
              <div className="agent-work-round-label">第 {round} 轮</div>

              {thoughts.filter((t) => t.round === round).map((thought, index) => (
                <div className="agent-thought" key={`t-${index}`}>
                  <span className="agent-thought-label">思考</span>
                  <p>{thought.content}</p>
                </div>
              ))}

              {calls.filter((c) => (c.round ?? 1) === round).map((call, index) => {
                const meta = TOOL_LABELS[call.tool] || { icon: '🔧', label: call.tool };
                return (
                  <details className="agent-toolcall" key={`c-${index}`}>
                    <summary>
                      <span className="agent-toolcall-name">{meta.icon} {meta.label}</span>
                      <code>{call.tool}</code>
                      <span className={`agent-toolcall-time ${call.elapsedMs == null ? 'running' : ''}`}>
                        {call.elapsedMs == null ? '进行中…' : `${call.elapsedMs}ms`}
                      </span>
                    </summary>
                    {call.arguments && call.arguments !== '{}' && (
                      <div className="agent-toolcall-args">参数：{call.arguments}</div>
                    )}
                    <div className="agent-toolcall-result">{call.resultSummary}</div>
                  </details>
                );
              })}
            </div>
          ))}

          {liveThought && (
            <div className="agent-work-round agent-work-round-live">
              <div className="agent-work-round-label">
                第 {liveThoughtRound || '…'} 轮 · 思考中
              </div>
              <div className="agent-thought live">
                <span className="agent-thought-label">思考</span>
                <p>{liveThought}</p>
              </div>
            </div>
          )}

          {waitingForRound && (
            <div className="agent-work-round agent-work-round-live">
              <div className="agent-work-round-label">第 {currentRound} 轮</div>
              <div className="agent-work-waiting">
                <span className="agent-dot" />
                <span className="agent-dot" />
                <span className="agent-dot" />
                <span>思考中…</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}