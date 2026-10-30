/** 社区时间展示：今天用相对时间，跨天显示日期，避免卡片上一串 ISO 字符串 */
export function formatCommunityTime(value) {
  if (!value) return '';
  // 后端 LocalDateTime 可能返回 "2026-10-30 21:19"，统一成 ISO 形式再解析
  const raw = typeof value === 'string' ? value.trim().replace(' ', 'T') : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday - startOfThatDay) / 86400000);

  if (dayDiff === 0) {
    const minutes = Math.floor((now - date) / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (dayDiff === 1) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}