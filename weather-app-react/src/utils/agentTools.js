/** 智能体工具的中文名与说明，工作轨迹、桌面浮窗和控制台共用 */
export const TOOL_LABELS = {
  list_farmlands: { icon: '📍', label: '查询地块列表', desc: '读取账号下的地块及地块 ID，确认当前能问哪些地。' },
  get_farmland_detail: { icon: '📋', label: '读取地块详情', desc: '获取面积、经纬度、土壤、灌溉和作物档案。' },
  get_weather: { icon: '🌤️', label: '获取天气预报', desc: '查该地块的实时天气和未来 7 天预报。' },
  get_crop_stage: { icon: '🌱', label: '判断生长阶段', desc: '按种植日期和作物档案判断当前处于哪个生长阶段。' },
  get_operation_advice: { icon: '📅', label: '农事决策引擎', desc: '调用平台内置规则，给出未来 7 天适宜/不宜的农事作业。' },
  check_alerts: { icon: '⚠️', label: '检查灾害预警', desc: '检查冻害、热害、涝害、大风等风险并生成预警。' },
  search_crop: { icon: '📚', label: '检索作物知识库', desc: '在 34 种作物的内置知识中检索品种、生育期和适宜条件。' },
};
