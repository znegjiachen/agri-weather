import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { farmlands as farmlandApi, crops } from '../api';
import FarmlandMap from '../components/FarmlandMap';
import { polygonAreaMu, polygonCenter, roundCoord } from '../utils/geo';

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export default function MapPage() {
  const [list, setList] = useState([]);
  const [cropList, setCropList] = useState([]);
  const [cropMap, setCropMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [satellite, setSatellite] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [finishOpen, setFinishOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCropId, setNewCropId] = useState('');
  const [saving, setSaving] = useState(false);

  const mapRef = useRef(null);
  const draftArea = useMemo(() => polygonAreaMu(draft), [draft]);

  useEffect(() => {
    farmlandApi.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    crops.list()
      .then((cs) => {
        setCropList(cs);
        setCropMap(Object.fromEntries(cs.map((c) => [c.id, c.cropName])));
      })
      .catch(() => {});
  }, []);

  const handleSelect = useCallback((farmland) => {
    setSelected(farmland);
    setWeather(null);
    setWeatherLoading(true);

    // 走缓存接口：预热后约 6ms
    farmlandApi.weather(farmland.id)
      .then((d) => setWeather(d.current || null))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false));
  }, []);

  const addPoint = useCallback((point) => {
    setDraft((prev) => [...prev, point]);
  }, []);

  const startDrawing = () => {
    setDrawing(true);
    setDraft([]);
    setFinishOpen(false);
    setSelected(null);
    setNewName('');
    setNewCropId('');
    setError('');
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setDraft([]);
    setFinishOpen(false);
    setError('');
  };

  const finishDrawing = () => {
    if (draft.length < 3) {
      setError('至少需要 3 个边界点才能围成地块');
      return;
    }
    setFinishOpen(true);
    setError('');
  };

  const savePlot = async () => {
    if (!newName.trim()) {
      setError('请填写地块名称');
      return;
    }
    const center = polygonCenter(draft);
    if (!center) {
      setError('边界数据不完整，请重新圈地');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const created = await farmlandApi.create({
        fieldName: newName.trim(),
        lat: roundCoord(center.lat, 2),
        lng: roundCoord(center.lng, 2),
        altitude: 0,
        areaMu: Number(polygonAreaMu(draft).toFixed(2)),
        soilType: '壤土',
        irrigationType: '滴灌',
        cropId: newCropId ? Number(newCropId) : null,
        boundary: JSON.stringify(draft.map((p) => ({
          lat: roundCoord(p.lat, 6),
          lng: roundCoord(p.lng, 6),
        }))),
      });

      setList((prev) => [...prev, created]);
      setDrawing(false);
      setDraft([]);
      setFinishOpen(false);
      setNewName('');
      setNewCropId('');
      setSelected(created);
      handleSelect(created);
    } catch (e) {
      setError(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const withCoords = list.filter(
    (f) => typeof f.lat === 'number' && typeof f.lng === 'number',
  );
  const missing = list.length - withCoords.length;

  return (
    <div className="map-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">🗺️ 地块地图</h2>
          <p className="page-subtitle">卫星底图圈地，自动计算亩数并保存边界</p>
        </div>
      </div>

      {error && <div className="agent-error">{error}</div>}
      {loading && <p className="empty-text">加载中…</p>}

      {!loading && (
        <>
          <div className="map-toolbar">
            <button
              type="button"
              className={`map-tool ${satellite ? 'active' : ''}`}
              onClick={() => setSatellite((v) => !v)}
            >
              🛰️ 卫星
            </button>
            <button
              type="button"
              className="map-tool"
              onClick={() => mapRef.current?.locate()}
            >
              📍 定位
            </button>

            {!drawing ? (
              <button type="button" className="map-tool primary" onClick={startDrawing}>
                ✏️ 圈地
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="map-tool"
                  onClick={() => setDraft((prev) => prev.slice(0, -1))}
                  disabled={draft.length === 0}
                >
                  ↩ 撤销
                </button>
                <button
                  type="button"
                  className="map-tool"
                  onClick={() => setDraft([])}
                  disabled={draft.length === 0}
                >
                  🗑 清空
                </button>
                <span className="map-draw-area">
                  {draft.length} 点 · {draftArea.toFixed(2)} 亩
                </span>
                <button
                  type="button"
                  className="map-tool primary"
                  onClick={finishDrawing}
                  disabled={draft.length < 3}
                >
                  ✅ 完成
                </button>
                <button type="button" className="map-tool" onClick={cancelDrawing}>
                  取消
                </button>
              </>
            )}
          </div>

          {drawing && (
            <p className="map-draw-hint">
              在地图上依次点击地块边界点，至少 3 个；面积会实时计算。
            </p>
          )}

          <FarmlandMap
            ref={mapRef}
            farmlands={withCoords}
            selectedId={selected?.id}
            onSelect={handleSelect}
            drawing={drawing}
            draftPoints={draft}
            onAddPoint={addPoint}
            onLocateError={setError}
            satellite={satellite}
          />

          {finishOpen && (
            <div className="glass map-draw-card">
              <h3>保存地块</h3>
              <p className="map-draw-summary">
                已圈 {draft.length} 个边界点 · 预计 {draftArea.toFixed(2)} 亩
              </p>
              <div className="map-draw-form">
                <input
                  className="community-input"
                  placeholder="地块名称"
                  maxLength={100}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <select
                  className="community-input"
                  value={newCropId}
                  onChange={(e) => setNewCropId(e.target.value)}
                >
                  <option value="">选择作物（可选）</option>
                  {cropList.map((c) => (
                    <option key={c.id} value={c.id}>{c.cropName}</option>
                  ))}
                </select>
              </div>
              <div className="map-draw-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setFinishOpen(false)}
                >
                  返回修改
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={savePlot}
                  disabled={saving || !newName.trim()}
                >
                  {saving ? '保存中…' : '保存地块'}
                </button>
              </div>
            </div>
          )}

          {!drawing && !finishOpen && list.length === 0 && (
            <p className="map-hint">
              还没有地块，点击「圈地」在地图上画一块吧。
              <Link to="/home/farmlands">也可以手动添加</Link>
            </p>
          )}

          {missing > 0 && (
            <p className="map-hint">
              有 {missing} 块地未设置经纬度，未在地图上显示。
              <Link to="/home/farmlands">去补全</Link>
            </p>
          )}

          {selected && !drawing && (
            <div className="glass map-card">
              <div className="map-card-head">
                <div>
                  <h3>{selected.fieldName}</h3>
                  <p className="map-card-sub">
                    {cropMap[selected.cropId] || '未设置作物'}
                    {selected.areaMu ? ` · ${selected.areaMu} 亩` : ''}
                    {selected.soilType ? ` · ${selected.soilType}` : ''}
                  </p>
                </div>
                <button className="map-card-close" onClick={() => setSelected(null)}>
                  ✕
                </button>
              </div>

              <div className="map-card-weather">
                {weatherLoading && <span className="empty-text">读取天气…</span>}
                {!weatherLoading && !weather && (
                  <span className="empty-text">暂时拿不到天气</span>
                )}
                {!weatherLoading && weather && (
                  <>
                    <span className="map-weather-icon">
                      {WEATHER_ICONS[weather.weather_code] || '🌡️'}
                    </span>
                    <span className="map-weather-temp">
                      {Math.round(weather.temperature_2m)}°
                    </span>
                    <span className="map-weather-meta">
                      湿度 {Math.round(weather.relative_humidity_2m)}% · 风速{' '}
                      {Math.round(weather.wind_speed_10m)} km/h
                    </span>
                  </>
                )}
              </div>

              <div className="map-card-actions">
                <Link to="/home/alerts" className="btn-cancel">查看预警</Link>
                <Link to="/home/farmlands" className="btn-primary">管理地块</Link>
              </div>
            </div>
          )}

          {!selected && !drawing && list.length > 0 && (
            <p className="map-hint">共 {withCoords.length} 块地已落图，点击地块查看详情</p>
          )}
        </>
      )}
    </div>
  );
}