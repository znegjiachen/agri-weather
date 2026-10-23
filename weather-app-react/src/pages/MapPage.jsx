import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { farmlands as farmlandApi, crops } from '../api';
import FarmlandMap from '../components/FarmlandMap';

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export default function MapPage() {
  const [list, setList] = useState([]);
  const [cropMap, setCropMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    farmlandApi.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    crops.list()
      .then((cs) => setCropMap(Object.fromEntries(cs.map((c) => [c.id, c.cropName]))))
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

  const withCoords = list.filter(
    (f) => typeof f.lat === 'number' && typeof f.lng === 'number',
  );
  const missing = list.length - withCoords.length;

  return (
    <div className="map-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">🗺️ 地块地图</h2>
          <p className="page-subtitle">点击标记查看地块与实时天气</p>
        </div>
      </div>

      {error && <div className="agent-error">{error}</div>}

      {loading && <p className="empty-text">加载中…</p>}

      {!loading && list.length === 0 && (
        <div className="glass section-card map-empty">
          <p className="empty-text">还没有地块</p>
          <Link to="/home/farmlands" className="btn-primary map-empty-btn">
            去添加地块
          </Link>
        </div>
      )}

      {!loading && list.length > 0 && (
        <>
          <FarmlandMap
            farmlands={withCoords}
            selectedId={selected?.id}
            onSelect={handleSelect}
          />

          {missing > 0 && (
            <p className="map-hint">
              有 {missing} 块地未设置经纬度，未在地图上显示。
              <Link to="/home/farmlands">去补全</Link>
            </p>
          )}

          {selected ? (
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
          ) : (
            <p className="map-hint">共 {withCoords.length} 块地已落图，点击标记查看详情</p>
          )}
        </>
      )}
    </div>
  );
}
