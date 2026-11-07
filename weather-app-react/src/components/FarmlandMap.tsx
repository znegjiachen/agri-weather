import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L, {
  type Map as LeafletMap,
  type TileLayer,
  type LayerGroup,
  type Marker,
  type Polygon,
  type PathOptions,
  type LeafletMouseEvent,
  type LocationEvent,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  gcj02ToWgs84,
  wgs84ToGcj02,
  parseBoundary,
  polygonAreaMu,
  polygonCenter,
  type LatLng,
} from '../utils/geo';

/**
 * 地块地图：高德路网/卫星底图 + 地块边界 + 圈地绘制 + 定位。
 *
 * 高德瓦片是 GCJ-02，数据库存 WGS84；所有坐标进出都做转换，
 * 否则标记会偏离影像几百米。
 */

const ROAD_TILE =
  'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}';
const SAT_TILE =
  'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}';
const LABEL_TILE =
  'https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}';

const CHINA_CENTER: [number, number] = [35.0, 105.0];

/** 地图组件消费的地块字段（与后端 Farmland 结构兼容） */
interface FarmlandLike {
  id: number | string;
  fieldName?: string;
  lat?: number | null;
  lng?: number | null;
  boundary?: string | null;
  areaMu?: number | null;
}

interface FarmlandMapProps {
  farmlands?: FarmlandLike[];
  selectedId?: number | null;
  onSelect?: (farmland: FarmlandLike) => void;
  drawing?: boolean;
  draftPoints?: LatLng[];
  onAddPoint?: (point: LatLng) => void;
  onLocateError?: (message: string) => void;
  satellite?: boolean;
}

/** 通过 ref 暴露给页面调用的地图方法 */
interface FarmlandMapHandle {
  locate(): void;
  flyTo(lat: number, lng: number, zoom?: number): void;
  fitAll(): void;
}

function pinIcon(active: boolean) {
  return L.divIcon({
    className: 'farm-marker',
    html: `<div class="farm-marker-pin${active ? ' active' : ''}">📍</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

function polygonStyle(active: boolean): PathOptions {
  return {
    color: active ? '#2563eb' : '#16a34a',
    weight: active ? 3 : 2,
    fillColor: active ? '#3b82f6' : '#22c55e',
    fillOpacity: active ? 0.24 : 0.14,
  };
}

const FarmlandMap = forwardRef<FarmlandMapHandle, FarmlandMapProps>(function FarmlandMap({
  farmlands = [],
  selectedId,
  onSelect,
  drawing = false,
  draftPoints = [],
  onAddPoint,
  onLocateError,
  satellite = true,
}, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const roadLayerRef = useRef<TileLayer | null>(null);
  const satLayerRef = useRef<TileLayer | null>(null);
  const labelLayerRef = useRef<TileLayer | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const polygonsRef = useRef(new Map<string, Polygon>());
  const draftLayerRef = useRef<LayerGroup | null>(null);
  const userMarkerRef = useRef<LayerGroup | null>(null);
  const locatedOnceRef = useRef(false);
  const hasFitRef = useRef(false);

  const drawingRef = useRef(drawing);
  const addPointRef = useRef(onAddPoint);
  const selectRef = useRef(onSelect);
  const locateErrorRef = useRef(onLocateError);

  useEffect(() => { drawingRef.current = drawing; }, [drawing]);
  useEffect(() => { addPointRef.current = onAddPoint; }, [onAddPoint]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { locateErrorRef.current = onLocateError; }, [onLocateError]);

  // 建图（只建一次）
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView(CHINA_CENTER, 4);

    roadLayerRef.current = L.tileLayer(ROAD_TILE, {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '© 高德地图',
    });
    satLayerRef.current = L.tileLayer(SAT_TILE, {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
      attribution: '© 高德地图',
    });
    labelLayerRef.current = L.tileLayer(LABEL_TILE, {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 18,
    });

    (satellite ? satLayerRef.current! : roadLayerRef.current!).addTo(map);
    if (satellite) labelLayerRef.current!.addTo(map);

    L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      const [lat, lng] = gcj02ToWgs84(event.latlng.lat, event.latlng.lng);
      addPointRef.current?.({ lat, lng });
    });

    map.on('locationfound', (event: LocationEvent) => {
      // 浏览器定位返回 WGS84，高德瓦片是 GCJ-02，不转换会偏几百米
      const [lat, lng] = wgs84ToGcj02(event.latlng.lat, event.latlng.lng);
      const accuracy = Math.max(10, Math.round(event.accuracy || 0));

      if (userMarkerRef.current) userMarkerRef.current.remove();
      const group = L.layerGroup().addTo(map);

      const circle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#2563eb',
        weight: 1.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);

      L.circleMarker([lat, lng], {
        radius: 8,
        color: '#fff',
        weight: 2,
        fillColor: '#2563eb',
        fillOpacity: 1,
      }).addTo(group).bindTooltip(`我的位置 · 精度约 ±${accuracy} 米`, {
        permanent: true,
        direction: 'top',
        className: 'geolocation-label',
      });

      userMarkerRef.current = group;

      // 只在首次定位时缩放；持续 watch 更新时不再反复移动地图
      if (!locatedOnceRef.current) {
        locatedOnceRef.current = true;
        map.fitBounds(circle.getBounds(), { padding: [40, 40], maxZoom: 18 });
      }
    });

    map.on('locationerror', () => {
      locateErrorRef.current?.('无法获取当前位置，请检查定位权限');
    });

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    const markers = markersRef.current;
    const polygons = polygonsRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers?.clear();
      polygons?.clear();
      userMarkerRef.current = null;
      hasFitRef.current = false;
    };
    // 初始化只跑一次；卫星图层随 prop 单独切换
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 路网 / 卫星切换
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !roadLayerRef.current) return;
    if (satellite) {
      map.removeLayer(roadLayerRef.current);
      satLayerRef.current!.addTo(map);
      labelLayerRef.current!.addTo(map);
    } else {
      map.removeLayer(satLayerRef.current!);
      map.removeLayer(labelLayerRef.current!);
      roadLayerRef.current.addTo(map);
    }
  }, [satellite]);

  // 已保存地块：无边界画标记，有边界画多边形
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const valid = (farmlands || []).filter(
      (f): f is FarmlandLike & { lat: number; lng: number } =>
        typeof f.lat === 'number' && typeof f.lng === 'number',
    );
    const validIds = new Set(valid.map((f) => String(f.id)));

    markersRef.current.forEach((layer, id) => {
      if (!validIds.has(id)) {
        layer.remove();
        markersRef.current.delete(id);
      }
    });
    polygonsRef.current.forEach((layer, id) => {
      if (!validIds.has(id)) {
        layer.remove();
        polygonsRef.current.delete(id);
      }
    });

    const drawn: [number, number][] = [];
    valid.forEach((f) => {
      const id = String(f.id);
      const boundary = parseBoundary(f.boundary);

      if (boundary) {
        const existingMarker = markersRef.current.get(id);
        if (existingMarker) {
          existingMarker.remove();
          markersRef.current.delete(id);
        }

        const latlngs = boundary.map((p) => wgs84ToGcj02(p.lat, p.lng));
        drawn.push(...latlngs);

        const area = typeof f.areaMu === 'number' ? f.areaMu : polygonAreaMu(boundary);
        const old = polygonsRef.current.get(id);
        if (old) old.remove();

        const polygon = L.polygon(latlngs, polygonStyle(id === String(selectedId)))
          .addTo(map)
          .bindTooltip(`${f.fieldName || '地块'} · ${Number(area).toFixed(2)} 亩`, {
            permanent: true,
            direction: 'center',
            className: 'field-area-label',
          })
          .on('click', (event: LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            if (!drawingRef.current) selectRef.current?.(f);
          });

        polygonsRef.current.set(id, polygon);
        return;
      }

      const oldPolygon = polygonsRef.current.get(id);
      if (oldPolygon) {
        oldPolygon.remove();
        polygonsRef.current.delete(id);
      }

      const marker = markersRef.current.get(id);
      const position = wgs84ToGcj02(f.lat, f.lng);
      drawn.push(position);

      if (marker) {
        marker.setLatLng(position);
      } else {
        const created = L.marker(position, { icon: pinIcon(false), title: f.fieldName })
          .addTo(map)
          .on('click', () => {
            if (!drawingRef.current) selectRef.current?.(f);
          });
        markersRef.current.set(id, created);
      }
    });

    if (!hasFitRef.current && drawn.length > 0) {
      map.fitBounds(L.latLngBounds(drawn), { padding: [40, 40], maxZoom: 15 });
      hasFitRef.current = true;
    }
  }, [farmlands, selectedId]);

  // 选中状态 + 定位到选中地块
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker, id) => {
      marker.setIcon(pinIcon(id === String(selectedId)));
    });
    polygonsRef.current.forEach((polygon, id) => {
      polygon.setStyle(polygonStyle(id === String(selectedId)));
      if (id === String(selectedId)) polygon.bringToFront();
    });

    if (!selectedId) return;
    const target = (farmlands || []).find((f) => f.id === selectedId);
    if (!target) return;

    const boundary = parseBoundary(target.boundary);
    if (boundary) {
      const bounds = L.latLngBounds(boundary.map((p) => wgs84ToGcj02(p.lat, p.lng)));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } else if (typeof target.lat === 'number' && typeof target.lng === 'number') {
      map.panTo(wgs84ToGcj02(target.lat, target.lng), { animate: true });
    }
  }, [selectedId, farmlands]);

  // 正在绘制的点、线、面
  useEffect(() => {
    const map = mapRef.current;
    const group = draftLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!drawing) return;

    const points = (draftPoints || []).map((p) => wgs84ToGcj02(p.lat, p.lng));

    points.forEach(([lat, lng], index) => {
      L.circleMarker([lat, lng], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#22c55e',
        fillOpacity: 1,
        interactive: false,
      }).addTo(group).bindTooltip(String(index + 1), {
        permanent: true,
        direction: 'top',
        className: 'draft-point-label',
      });
    });

    if (points.length >= 2) {
      L.polyline(points, {
        color: '#22c55e',
        weight: 3,
        dashArray: '6 4',
        interactive: false,
      }).addTo(group);
    }

    if (points.length >= 3) {
      L.polygon(points, {
        color: '#22c55e',
        weight: 3,
        fillColor: '#22c55e',
        fillOpacity: 0.18,
        dashArray: '6 4',
        interactive: false,
      }).addTo(group);

      const center = polygonCenter(draftPoints);
      if (center) {
        const [lat, lng] = wgs84ToGcj02(center.lat, center.lng);
        L.marker([lat, lng], {
          interactive: false,
          icon: L.divIcon({
            className: 'draft-area-label',
            html: `${polygonAreaMu(draftPoints).toFixed(2)} 亩`,
            iconSize: [90, 26],
            iconAnchor: [45, 13],
          }),
        }).addTo(group);
      }
    }
  }, [drawing, draftPoints]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: [number, number][] = [];
    (farmlands || []).forEach((f) => {
      const boundary = parseBoundary(f.boundary);
      if (boundary) {
        boundary.forEach((p) => points.push(wgs84ToGcj02(p.lat, p.lng)));
      } else if (typeof f.lat === 'number' && typeof f.lng === 'number') {
        points.push(wgs84ToGcj02(f.lat, f.lng));
      }
    });
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    }
  };

  useImperativeHandle(ref, () => ({
    locate() {
      const map = mapRef.current;
      if (!map) return;
      map.stopLocate();
      locatedOnceRef.current = false;
      map.locate({
        setView: false,
        // 持续监听，GPS/Wi-Fi 精度稳定后再绘制最终位置
        watch: true,
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    },
    /** 定位到指定 GCJ-02 坐标（省市县选择用） */
    flyTo(lat: number, lng: number, zoom = 12) {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo([lat, lng], zoom, { duration: 0.8 });
    },
    fitAll,
  }));

  return <div className="farmland-map" ref={containerRef} />;
});

export default FarmlandMap;