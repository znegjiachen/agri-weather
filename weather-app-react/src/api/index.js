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
  markRead: (id) => request(`/api/alerts/${id}/read`, { method: 'PUT' }),
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
  list: (cursor, size = 10) => {
    const qs = new URLSearchParams({ size: String(size) });
    if (cursor) qs.set('cursor', String(cursor));
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

// Agent（农事智能体）
export const agent = {
  chat: (message, history = []) =>
    request('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
  status: () => request('/api/agent/status'),
  tools: () => request('/api/agent/tools'),
};
