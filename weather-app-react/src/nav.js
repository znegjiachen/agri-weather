/**
 * 导航配置。桌面侧边栏和手机底部 Tab 共用同一份数据，避免两处各维护一套。
 */

export const PRIMARY_NAV = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/community', label: '社区', icon: '💬' },
  { to: '/agent', label: '农事助手', icon: '🤖' },
  { to: '/profile', label: '个人中心', icon: '👤' },
];

/** 首页九宫格 / 侧边栏次级的 5 个功能页 */
export const SUB_NAV = [
  { to: '/home/crops', label: '作物适配', icon: '🌱', desc: '多因子匹配评分' },
  { to: '/home/pests', label: '病虫害库', icon: '🐛', desc: '阈值与防治方案' },
  { to: '/home/alerts', label: '预警中心', icon: '🔔', desc: '灾害预警提醒' },
  { to: '/home/farmlands', label: '地块管理', icon: '📍', desc: '地块与作物档案' },
  { to: '/home/map', label: '地块地图', icon: '🗺️', desc: '地图上查看地块' },
  { to: '/home/weather', label: '天气预报', icon: '🌤️', desc: '实时与 7 日预报' },
];

/**
 * 首页 Tab 在子页面（/home/*）下也应保持高亮，
 * 但不能像 NavLink 的 end=false 那样对所有路径都命中。
 */
export function isNavActive(pathname, to) {
  if (to === '/') {
    return pathname === '/' || pathname.startsWith('/home/');
  }
  return pathname === to || pathname.startsWith(to + '/');
}
