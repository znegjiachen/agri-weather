import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import Markdown from 'react-markdown';
import { agent as agentApi } from '../api';
import { useAgent } from '../context/AgentContext';

const MAX_IMAGES = 3;

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

/** 上传前压到最长边 1600px，减少视觉模型等待时间和流量 */
async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('图片过大，请选择 20MB 以内的照片');
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('图片处理失败');
    return new File([blob], `${file.name.replace(/\.\w+$/, '') || 'photo'}.jpg`, {
      type: 'image/jpeg',
    });
  } catch (e) {
    // 浏览器解不了的格式（如部分 HEIC）交给后端报错，小图直接上传
    if (file.size <= 5 * 1024 * 1024) return file;
    throw new Error('图片处理失败，请换一张 JPG/PNG 照片');
  }
}

/** 把结构化识别结果转成文字，用于展示给智能体和历史消息 */
function formatVision(vision) {
  if (!vision) return '';
  const lines = [];
  lines.push(`植物：${vision.plantName || '未识别'}${vision.scientificName ? `（${vision.scientificName}）` : ''}`);
  lines.push(`生长阶段：${vision.growthStage || '无法判断'}`);
  lines.push(`健康状态：${vision.healthStatus || '无法判断'}`);

  if (vision.issues?.length) {
    lines.push('发现的问题：');
    vision.issues.forEach((issue, index) => {
      const confidence = typeof issue.confidence === 'number'
        ? `，置信度 ${Math.round(issue.confidence * 100)}%`
        : '';
      lines.push(`${index + 1}. [${issue.type || 'unknown'}] ${issue.name || '未知问题'}${confidence}`);
      if (issue.symptoms) lines.push(`   症状：${issue.symptoms}`);
      if (issue.suggestion) lines.push(`   建议：${issue.suggestion}`);
    });
  } else {
    lines.push('未发现明显问题。');
  }

  if (vision.overallAssessment) lines.push(`综合判断：${vision.overallAssessment}`);
  if (vision.careAdvice?.length) {
    lines.push('照护建议：');
    vision.careAdvice.forEach((advice, index) => lines.push(`${index + 1}. ${advice}`));
  }
  return lines.join('\n');
}

/**
 * 助农手（问田农事顾问）对话页。
 *
 * messages 由 App 持有并传入 —— 本组件是条件渲染的，切板块时会被卸载，
 * 状态放在这里会随组件一起丢失。草稿、附件、加载状态留在本地。
 */
export default function AgentPage() {
  const { messages, setMessages } = useAgent();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [attachments, setAttachments] = useState([]);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);
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
    if ((!content && files.length === 0) || loading) return;

    const question = content || '请看看这些作物照片，帮我判断植物种类、生长阶段和健康状况。';
    setError('');
    setInput('');
    setAttachments([]);

    // 历史里把之前的图片识别结果带上，后续追问时模型仍能参考
    const history = messages.map((m) => ({
      role: m.role,
      content: m.role === 'user' && m.vision
        ? `${m.content}\n\n【图片识别结果（视觉模型提供，供参考）】\n${formatVision(m.vision)}`
        : m.content,
    }));

    clearLiveBuffer();
    liveRef.current.round = null;
    setMessages((prev) => [...prev, { role: 'user', content: question, images: previews }]);
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
      });

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
    messages.forEach((m) => {
      (m.images || []).forEach((url) => URL.revokeObjectURL(url));
    });
    attachments.forEach((item) => URL.revokeObjectURL(item.preview));
    setAttachments([]);
    setMessages([]);
    setError('');
  };

  const notConfigured = status && status.configured === false;
  const canSend = !loading && !notConfigured && (input.trim().length > 0 || attachments.length > 0);

  return (
    <div className="agent-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">🤖 问田 · 助农手</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            内容由AI生成，仅供参考
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
          {messages.length === 0 && (
            <div className="agent-welcome">
              <div className="agent-welcome-icon">🌾</div>
              <h3>你好，我是助农手，问田的农事顾问</h3>
              <p>
                可以问地块、天气和农事安排，也可以直接上传作物照片，
                我帮你看植物种类、生长阶段和病害。
              </p>

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
                {m.images?.length > 0 && (
                  <div className="agent-msg-images">
                    {m.images.map((src) => (
                      <img key={src} src={src} alt="上传的作物照片" />
                    ))}
                  </div>
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
            disabled={loading || notConfigured}
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
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="你有什么想知道的，快来问问我"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || notConfigured}
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