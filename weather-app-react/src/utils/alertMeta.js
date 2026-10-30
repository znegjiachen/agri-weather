/** 预警级别：颜色、文案、排序权重 */
export const ALERT_LEVELS = {
  RED: { label: '严重', cls: 'red', color: '#ef4444', rank: 4 },
  ORANGE: { label: '较重', cls: 'orange', color: '#f97316', rank: 3 },
  YELLOW: { label: '注意', cls: 'yellow', color: '#eab308', rank: 2 },
  BLUE: { label: '提示', cls: 'blue', color: '#3b82f6', rank: 1 },
  GREEN: { label: '正常', cls: 'green', color: '#22c55e', rank: 0 },
};

/** 预警类型：中文名 + 图标；兼容新旧两套类型名 */
export const ALERT_TYPES = {
  FROST: { label: '冻害', icon: '❄️' },
  HEAT: { label: '热害', icon: '🔥' },
  TEMP_LOW: { label: '低温', icon: '🌡️' },
  TEMP_HIGH: { label: '高温', icon: '🌡️' },
  RAINSTORM: { label: '暴雨涝害', icon: '🌧️' },
  RAIN_CONTINUOUS: { label: '连阴雨', icon: '🌧️' },
  WIND: { label: '大风', icon: '💨' },
  PEST: { label: '病虫害', icon: '🐛' },
  HUMIDITY_LOW: { label: '湿度偏低', icon: '💧' },
  HUMIDITY_HIGH: { label: '湿度偏高', icon: '💧' },
  INFO: { label: '提示', icon: 'ℹ️' },
  NORMAL: { label: '正常', icon: '✅' },
};

export function alertLevelMeta(level) {
  return ALERT_LEVELS[level] || { label: level || '未知', cls: 'blue', color: '#94a3b8', rank: 0 };
}

export function alertTypeMeta(type) {
  return ALERT_TYPES[type] || { label: type || '预警', icon: '⚠️' };
}

export function alertTypeClass(type) {
  return `type-${String(type || 'info').toLowerCase()}`;
}