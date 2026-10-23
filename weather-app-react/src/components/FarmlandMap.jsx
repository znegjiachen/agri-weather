import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * 地块地图。
 *
 * 刻意不用 react-leaflet：它对 React 版本的 peer 约束容易冲突，
 * 而这里只需要「建图 / 打点 / 点击回调」三件事，原生 API 足够且更可控。
 *
 * 瓦片用高德：国内访问快，且不需要申请 Key。
 * 若要换成自建或 OSM，改 TILE_URL 即可。
 */
const TILE_URL =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';

const CHINA_CENTER = [35.0, 105.0];

function pinIcon(active) {
  return L.divIcon({
    className: 'farm-marker',
    html: `<div class="farm-marker-pin${active ? ' active' : ''}">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

export default function FarmlandMap({ farmlands, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const hasFitRef = useRef(false);

  // 建图（只建一次）
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView(CHINA_CENTER, 4);

    L.tileLayer(TILE_URL, {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '© 高德地图',
    }).addTo(map);

    mapRef.current = map;

    // 容器尺寸在挂载瞬间可能还没算好，修正一次避免灰块
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      hasFitRef.current = false;
    };
  }, []);

  // 数据变化时同步标记
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = (farmlands || []).filter(
      (f) => typeof f.lat === 'number' && typeof f.lng === 'number',
    );
    const validIds = new Set(valid.map((f) => String(f.id)));

    // 移除已不存在的
    markersRef.current.forEach((marker, id) => {
      if (!validIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // 增补新的
    valid.forEach((f) => {
      const id = String(f.id);
      if (markersRef.current.has(id)) return;

      const marker = L.marker([f.lat, f.lng], { icon: pinIcon(false), title: f.fieldName })
        .addTo(map)
        .on('click', () => onSelect?.(f));

      markersRef.current.set(id, marker);
    });

    // 首次有数据时自动缩放到全部地块
    if (!hasFitRef.current && valid.length > 0) {
      const bounds = L.latLngBounds(valid.map((f) => [f.lat, f.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      hasFitRef.current = true;
    }
  }, [farmlands, onSelect]);

  // 选中态：换图标 + 平移过去
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(pinIcon(id === String(selectedId)));
    });

    if (!selectedId) return;
    const target = (farmlands || []).find((f) => f.id === selectedId);
    if (target && mapRef.current) {
      mapRef.current.panTo([target.lat, target.lng], { animate: true });
    }
  }, [selectedId, farmlands]);

  return <div className="farmland-map" ref={containerRef} />;
}
