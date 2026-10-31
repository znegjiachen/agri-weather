/**
 * 地块表单的可选值与默认推荐。
 *
 * 土壤按经纬度做粗略分区估算，灌溉方式按作物给最常见的做法；
 * 都只是「默认值」，用户可以在表单里手动改。
 */

export const SOIL_TYPES = ['壤土', '沙土', '黏土', '红壤', '黑土', '盐碱土'];
export const IRRIGATION_TYPES = ['漫灌', '滴灌', '喷灌', '渗灌', '雨水'];
export const DEFAULT_SOIL = '壤土';
export const DEFAULT_IRRIGATION = '滴灌';

// 粗略的分区经验值，仅用于给表单一个合理的初始值，不构成土壤普查结论
const SOIL_REGIONS = [
  { soil: '黑土', minLat: 42, maxLat: 50, minLng: 118, maxLng: 135 },   // 东北平原
  { soil: '沙土', minLat: 35, maxLat: 48, minLng: 73, maxLng: 100 },    // 新疆绿洲
  { soil: '盐碱土', minLat: 36, maxLat: 42, minLng: 100, maxLng: 112 }, // 河西 / 河套
  { soil: '红壤', minLat: 18, maxLat: 32, minLng: 105, maxLng: 123 },   // 华南 / 江南丘陵
  { soil: '黏土', minLat: 22, maxLat: 32, minLng: 97, maxLng: 105 },    // 西南山地
];

export function suggestSoil(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return DEFAULT_SOIL;
  const hit = SOIL_REGIONS.find((r) => (
    lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng
  ));
  return hit ? hit.soil : DEFAULT_SOIL;
}

// 各作物最常见的灌溉方式
const CROP_IRRIGATION = {
  水稻: '漫灌',
  甘蔗: '漫灌',
  香蕉: '漫灌',
  小麦: '喷灌',
  大麦: '喷灌',
  谷子: '喷灌',
  高粱: '喷灌',
  大豆: '喷灌',
  绿豆: '喷灌',
  豌豆: '喷灌',
  花生: '喷灌',
  油菜: '喷灌',
  茶叶: '喷灌',
  玉米: '滴灌',
  棉花: '滴灌',
  番茄: '滴灌',
  黄瓜: '滴灌',
  辣椒: '滴灌',
  茄子: '滴灌',
  大白菜: '滴灌',
  萝卜: '滴灌',
  胡萝卜: '滴灌',
  菠菜: '滴灌',
  生菜: '滴灌',
  大蒜: '滴灌',
  西瓜: '滴灌',
  草莓: '滴灌',
  马铃薯: '滴灌',
  甘薯: '滴灌',
  苹果: '滴灌',
  梨: '滴灌',
  桃: '滴灌',
  柑橘: '滴灌',
  葡萄: '滴灌',
};

export function suggestIrrigation(cropName) {
  if (!cropName) return DEFAULT_IRRIGATION;
  return CROP_IRRIGATION[cropName] || DEFAULT_IRRIGATION;
}