/**
 * 地图坐标工具。
 *
 * 高德瓦片使用 GCJ-02 坐标系，而数据库里存 WGS84（Open-Meteo、GPS 都用它）。
 * 直接叠会偏移几百米，所以显示前转 GCJ-02，地图点击再转回 WGS84 入库。
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y
    + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y
    + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

export function wgs84ToGcj02(lat, lng) {
  if (outOfChina(lng, lat)) return [lat, lng];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lat + dLat, lng + dLng];
}

export function gcj02ToWgs84(lat, lng) {
  if (outOfChina(lng, lat)) return [lat, lng];
  let wLat = lat;
  let wLng = lng;
  for (let i = 0; i < 3; i += 1) {
    const [gLat, gLng] = wgs84ToGcj02(wLat, wLng);
    wLat -= gLat - lat;
    wLng -= gLng - lng;
  }
  return [wLat, wLng];
}

/** 球面多边形面积（平方米）；地块都很小，这个公式足够准 */
function ringAreaMeters(points) {
  if (!points || points.length < 3) return 0;
  const R = 6378137;
  const rad = (v) => (v * PI) / 180;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    area += (rad(p2.lng) - rad(p1.lng))
      * (2 + Math.sin(rad(p1.lat)) + Math.sin(rad(p2.lat)));
  }
  return Math.abs((area * R * R) / 2);
}

const MU_PER_SQUARE_METER = 1 / 666.6666667;

/** 面积（亩），保留两位小数由调用方决定 */
export function polygonAreaMu(points) {
  return ringAreaMeters(points) * MU_PER_SQUARE_METER;
}

export function polygonCenter(points) {
  if (!points || points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({
    lat: acc.lat + p.lat,
    lng: acc.lng + p.lng,
  }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/** 数据库里是 JSON 字符串；兼容数组，过滤非法点 */
export function parseBoundary(raw) {
  if (!raw) return null;
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value) || value.length < 3) return null;
    const points = value
      .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
        && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
    return points.length >= 3 ? points : null;
  } catch {
    return null;
  }
}

export function roundCoord(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}