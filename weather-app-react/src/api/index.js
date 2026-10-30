// 开发环境用 localhost，生产构建时 VITE_API_BASE 设为空（走 Nginx 代理 /api）
const BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:8082';

function getToken() {
  return localStorage.getItem('token');
}

/** 统一的 401 处理：清登录态并通知全局弹层 */
function handleUnauthorized(data) {
  const message = data?.message || data?.error || '登录已过期，请重新登录';
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new CustomEvent('auth:expired', { detail: message }));
  throw new Error(message);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (res.status === 401) handleUnauthorized(data);

  // 后端统一把中文提示放在 message，error 只是机器可读的 code
  if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
  return data;
}

// Auth
export const auth = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
};

// Crops
export const crops = {
  list: () => request('/api/crops'),
  get: (id) => request(`/api/crops/${id}`),
  stages: (cropId) => request(`/api/crops/${cropId}/stages`),
  weatherMatch: (cropId, params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/crops/${cropId}/weather-match?${qs}`);
  },
  currentStage: (cropId, plantDate) =>
    request(`/api/crops/${cropId}/current-stage?plantDate=${plantDate}`),
};

// Farmlands
export const farmlands = {
  list: () => request('/api/farmlands'),
  create: (body) => request('/api/farmlands', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/api/farmlands/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/api/farmlands/${id}`, { method: 'DELETE' }),
  weather: (id) => request(`/api/farmlands/${id}/weather`),
  alerts: (id) => request(`/api/farmlands/${id}/alerts`),
  advice: (id) => request(`/api/farmlands/${id}/advice`),
};

// Pests
export const pests = {
  list: () => request('/api/pests'),
  byType: (type) => request(`/api/pests/type/${type}`),
};

// Alerts
export const alerts = {
  list: () => request('/api/alerts'),
  unreadCount: () => request('/api/alerts/unread-count'),
  refresh: () => request('/api/alerts/refresh', { method: 'POST' }),
  markRead: (id) => request(`/api/alerts/${id}/read`, { method: 'PUT' }),
  handle: (id) => request(`/api/alerts/${id}/handle`, { method: 'PUT' }),
  markAllRead: () => request('/api/alerts/read-all', { method: 'PUT' }),
  check: (farmlandId, params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/alerts/check/${farmlandId}?${qs}`);
  },
};

// Operations
export const operations = {
  advice: (farmlandId, forecast) =>
    request(`/api/operations/advice/${farmlandId}`, {
      method: 'POST',
      body: JSON.stringify(forecast),
    }),
};

// Community（农友社区）
export const community = {
  list: (cursor, size = 10, { q, category } = {}) => {
    const qs = new URLSearchParams({ size: String(size) });
    if (cursor) qs.set('cursor', String(cursor));
    if (q) qs.set('q', q);
    if (category) qs.set('category', category);
    return request(`/api/community/posts?${qs.toString()}`);
  },
  detail: (id) => request(`/api/community/posts/${id}`),
  create: (body) => request('/api/community/posts', { method: 'POST', body: JSON.stringify(body) }),
  comment: (id, content) =>
    request(`/api/community/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  like: (id) => request(`/api/community/posts/${id}/like`, { method: 'POST' }),
  unlike: (id) => request(`/api/community/posts/${id}/like`, { method: 'DELETE' }),
  remove: (id) => request(`/api/community/posts/${id}`, { method: 'DELETE' }),

  /**
   * 上传图片。必须走独立的 fetch：
   * 不能自己设 Content-Type —— 浏览器要为 multipart 生成 boundary。
   */
  uploadImage: async (file) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${BASE_URL}/api/community/images`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => null);

    if (res.status === 401) handleUnauthorized(data);
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
  },
};

// Agent（助农手 农事智能体）
export const agent = {
  chat: (message, history = [], visionContext = '', context = {}) =>
    request('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history,
        ...(visionContext ? { visionContext } : {}),
        ...(context.agentId ? { agentId: context.agentId } : {}),
        ...(context.farmlandId ? { farmlandId: context.farmlandId } : {}),
        ...(context.visionJson ? { visionJson: context.visionJson } : {}),
      }),
    }),

  /**
   * 流式对话：思考、工具开始/结束实时回调，最后返回 done 事件里的完整结果。
   * SSE 用 fetch + ReadableStream 读，因为 EventSource 不支持 POST/Authorization。
   */
  chatStream: async (message, history = [], visionContext = '', handlers = {}, context = {}) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/agent/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        history,
        ...(visionContext ? { visionContext } : {}),
        ...(context.agentId ? { agentId: context.agentId } : {}),
        ...(context.farmlandId ? { farmlandId: context.farmlandId } : {}),
        ...(context.visionJson ? { visionJson: context.visionJson } : {}),
      }),
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => null);
      handleUnauthorized(data);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    }
    if (!res.body) throw new Error('当前浏览器不支持流式响应');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalResult = null;

    const dispatch = (frame) => {
      let event = 'message';
      const dataLines = [];
      frame.split(/\r?\n/).forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      });
      if (dataLines.length === 0) return;

      let payload;
      try {
        payload = JSON.parse(dataLines.join('\n'));
      } catch {
        return;
      }

      if (event === 'round') handlers.onRound?.(payload);
      else if (event === 'reasoning_delta') handlers.onReasoningDelta?.(payload);
      else if (event === 'content_delta') handlers.onContentDelta?.(payload);
      else if (event === 'thought') handlers.onThought?.(payload);
      else if (event === 'tool_start') handlers.onToolStarted?.(payload);
      else if (event === 'tool_end') handlers.onToolFinished?.(payload);
      else if (event === 'done') finalResult = payload;
      else if (event === 'error') throw new Error(payload.message || '智能体处理失败');
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let match = buffer.match(/\r?\n\r?\n/);
        while (match) {
          const frame = buffer.slice(0, match.index);
          buffer = buffer.slice(match.index + match[0].length);
          if (frame.trim()) dispatch(frame);
          match = buffer.match(/\r?\n\r?\n/);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) dispatch(buffer);
    } finally {
      try { reader.releaseLock(); } catch { /* 已释放 */ }
    }

    if (!finalResult) throw new Error('连接中断，请重试');
    return finalResult;
  },

  /** 上传作物照片给视觉模型识别，返回结构化结果 */
  vision: async (files, note = '') => {
    const token = getToken();
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    if (note) form.append('note', note);

    const res = await fetch(`${BASE_URL}/api/agent/vision`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => null);

    if (res.status === 401) handleUnauthorized(data);
    if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
    return data;
  },
  status: () => request('/api/agent/status'),
  tools: () => request('/api/agent/tools'),
};

// Agents（每块地一个专属助农手 + 知识库）
export const agents = {
  list: () => request('/api/agents'),
  get: (id) => request(`/api/agents/${id}`),
  update: (id, body) => request(`/api/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  reset: (id) => request(`/api/agents/${id}/reset`, { method: 'POST' }),
  sync: () => request('/api/agents/sync', { method: 'POST' }),
  messages: (id, limit = 50) => request(`/api/agents/${id}/messages?limit=${limit}`),
  clearMessages: (id) => request(`/api/agents/${id}/messages`, { method: 'DELETE' }),

  knowledge: {
    list: (agentId) => request(`/api/agents/${agentId}/knowledge`),
    getDoc: (agentId, docId) => request(`/api/agents/${agentId}/knowledge/${docId}`),
    addText: (agentId, body) => request(`/api/agents/${agentId}/knowledge/text`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    remove: (agentId, docId) => request(`/api/agents/${agentId}/knowledge/${docId}`, {
      method: 'DELETE',
    }),
    search: (agentId, query) => request(`/api/agents/${agentId}/knowledge/search`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
    reindex: (agentId) => request(`/api/agents/${agentId}/knowledge/reindex`, {
      method: 'POST',
    }),

    /** multipart 不能手动设 Content-Type，浏览器要自己生成 boundary */
    uploadFile: async (agentId, file, title = '') => {
      const token = getToken();
      const form = new FormData();
      form.append('file', file);
      if (title) form.append('title', title);

      const res = await fetch(`${BASE_URL}/api/agents/${agentId}/knowledge/file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => null);

      if (res.status === 401) handleUnauthorized(data);
      if (!res.ok) throw new Error(data?.message || data?.error || `HTTP ${res.status}`);
      return data;
    },
  },
};
