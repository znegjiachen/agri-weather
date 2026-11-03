import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { agent as agentApi, farmlands as farmlandApi, crops } from '../api';
import FarmlandMap from '../components/FarmlandMap';
import { polygonAreaMu, polygonCenter, roundCoord } from '../utils/geo';
import {
  SOIL_TYPES, IRRIGATION_TYPES, suggestSoil, suggestIrrigation,
} from '../utils/farmlandDefaults';

interface RegionOption {
  name: string;
  adcode: number;
  center: [number, number];
  level: string;
}

const REGION_ROOT_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const regionUrl = (adcode: number) =>
  `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`;

async function fetchRegionOptions(url: string): Promise<RegionOption[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('行政区划数据加载失败');
  const data = await response.json();
  return (data.features || [])
    .map((feature: any) => {
      const props = feature.properties || {};
      const center = props.center;
      if (!Array.isArray(center) || center.length < 2) return null;
      return {
        name: props.name,
        adcode: Number(props.adcode),
        center: [Number(center[0]), Number(center[1])] as [number, number],
        level: props.level || '',
      };
    })
    .filter(Boolean) as RegionOption[];
}

const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [cropList, setCropList] = useState([]);
  const [cropMap, setCropMap] = useState({});
  const [selected, setSelected] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [satellite, setSatellite] = useState(true);
  // 从「添加地块」跳转过来时直接进入圈地模式
  const [drawing, setDrawing] = useState(() => searchParams.get('draw') === '1');
  const [draft, setDraft] = useState([]);
  const [finishOpen, setFinishOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCropId, setNewCropId] = useState('');
  const [newSoilType, setNewSoilType] = useState('');
  const [newIrrigationType, setNewIrrigationType] = useState('');
  const [soilTouched, setSoilTouched] = useState(false);
  const [irrigationTouched, setIrrigationTouched] = useState(false);
  const [planFile, setPlanFile] = useState(null);
  const [planNotice, setPlanNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const mapRef = useRef(null);
  const draftArea = useMemo(() => polygonAreaMu(draft), [draft]);

  // 圈地参数只用一次，清掉以免刷新或返回时重复进入
  useEffect(() => {
    if (searchParams.get('draw') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('draw');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // 省 / 市 / 县区选择：数据来自阿里 DataV 行政区划（GCJ-02，与高德底图一致）
  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState('');
  const regionSeq = useRef(0);

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

  useEffect(() => {
    let alive = true;
    fetchRegionOptions(REGION_ROOT_URL)
      .then((options) => { if (alive) setProvinces(options); })
      .catch(() => { if (alive) setRegionError('行政区划数据加载失败，可手动拖动地图'); });
    return () => { alive = false; };
  }, []);

  const flyToRegion = (region?: RegionOption, zoom = 12) => {
    if (!region) return;
    const [lng, lat] = region.center;
    mapRef.current?.flyTo(lat, lng, zoom);
  };

  const handleProvinceChange = async (value: string) => {
    setProvinceCode(value);
    setCityCode('');
    setDistrictCode('');
    setCities([]);
    setDistricts([]);
    setRegionError('');
    if (!value) return;

    const province = provinces.find((item) => String(item.adcode) === value);
    flyToRegion(province, 8);
    const seq = ++regionSeq.current;
    setRegionLoading(true);
    try {
      const options = await fetchRegionOptions(regionUrl(Number(value)));
      if (seq !== regionSeq.current) return;
      if (options.some((item) => item.level === 'city')) {
        setCities(options);
      } else {
        // 直辖市等：省下一级直接是区县
        setDistricts(options);
      }
    } catch {
      if (seq === regionSeq.current) setRegionError('该省份下级区划加载失败');
    } finally {
      if (seq === regionSeq.current) setRegionLoading(false);
    }
  };

  const handleCityChange = async (value: string) => {
    setCityCode(value);
    setDistrictCode('');
    setDistricts([]);
    setRegionError('');
    if (!value) return;

    const city = cities.find((item) => String(item.adcode) === value);
    flyToRegion(city, 10);
    const seq = ++regionSeq.current;
    setRegionLoading(true);
    try {
      const options = await fetchRegionOptions(regionUrl(Number(value)));
      if (seq !== regionSeq.current) return;
      setDistricts(options);
    } catch {
      if (seq === regionSeq.current) setRegionError('该城市区县数据加载失败');
    } finally {
      if (seq === regionSeq.current) setRegionLoading(false);
    }
  };

  const handleDistrictChange = (value: string) => {
    setDistrictCode(value);
    const district = districts.find((item) => String(item.adcode) === value);
    flyToRegion(district, 13);
  };

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

  const cropNameOf = (id) => cropList.find((c) => String(c.id) === String(id))?.cropName;

  const startDrawing = () => {
    setDrawing(true);
    setDraft([]);
    setFinishOpen(false);
    setSelected(null);
    setNewName('');
    setNewCropId('');
    setNewSoilType('');
    setNewIrrigationType('');
    setSoilTouched(false);
    setIrrigationTouched(false);
    setPlanFile(null);
    setPlanNotice('');
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
    // 圈完地先按中心点估算土壤，灌溉按已选作物给默认值
    const center = polygonCenter(draft);
    if (center && !soilTouched) {
      setNewSoilType(suggestSoil(center.lat, center.lng));
    }
    if (!irrigationTouched) {
      setNewIrrigationType(suggestIrrigation(cropNameOf(newCropId)));
    }
    setFinishOpen(true);
    setError('');
  };

  const handlePlanFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|markdown|pdf|doc|docx)$/i.test(file.name)) {
      setError('种植计划支持 TXT、Markdown、PDF、Word');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('种植计划不能超过 5MB');
      return;
    }
    setPlanFile(file);
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
        altitude: null,
        soilType: newSoilType || null,
        irrigationType: newIrrigationType || null,
        cropId: newCropId ? Number(newCropId) : null,
        boundary: JSON.stringify(draft.map((p) => ({
          lat: roundCoord(p.lat, 6),
          lng: roundCoord(p.lng, 6),
        }))),
      });

      // 圈地时可选带上种植计划：保存后解析成任务，供首页/农事记录直接执行
      if (planFile) {
        try {
          const document = await agentApi.document(planFile);
          const preview = await farmlandApi.tasks.extract(created.id, document.id);
          const sourceName = document.filename || planFile.name;
          if (Array.isArray(preview) && preview.length > 0) {
            await farmlandApi.tasks.confirm(created.id, { tasks: preview, sourceName });
            setPlanNotice(`已根据《${sourceName}》生成 ${preview.length} 条种植任务，可在「地块记录 → 计划任务」查看。`);
          } else {
            setPlanNotice('种植计划已上传，但没有识别到可执行任务，可在「地块记录 → 计划任务」补充。');
          }
        } catch (e) {
          setPlanNotice(`地块已保存，但种植计划解析失败：${e.message || '请稍后在地块记录里重试'}`);
        }
      }

      setList((prev) => [...prev, created]);
      setDrawing(false);
      setDraft([]);
      setFinishOpen(false);
      setNewName('');
      setNewCropId('');
      setNewSoilType('');
      setNewIrrigationType('');
      setSoilTouched(false);
      setIrrigationTouched(false);
      setPlanFile(null);
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
      {planNotice && (
        <div className="map-plan-notice">
          <span>🌱 {planNotice}</span>
          <button type="button" onClick={() => setPlanNotice('')} aria-label="关闭提示">×</button>
        </div>
      )}
      {loading && <p className="empty-text">加载中…</p>}

      {!loading && (
        <>
          <div className="map-region-bar">
            <span className="map-region-label">📍 区域定位</span>
            <select
              value={provinceCode}
              onChange={(e) => handleProvinceChange(e.target.value)}
              aria-label="选择省份"
            >
              <option value="">省份</option>
              {provinces.map((item) => (
                <option key={item.adcode} value={item.adcode}>{item.name}</option>
              ))}
            </select>
            <select
              value={cityCode}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={cities.length === 0}
              aria-label="选择城市"
            >
              <option value="">城市</option>
              {cities.map((item) => (
                <option key={item.adcode} value={item.adcode}>{item.name}</option>
              ))}
            </select>
            <select
              value={districtCode}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={districts.length === 0}
              aria-label="选择区县"
            >
              <option value="">区 / 县</option>
              {districts.map((item) => (
                <option key={item.adcode} value={item.adcode}>{item.name}</option>
              ))}
            </select>
            {regionLoading && <span className="map-region-tip">加载中…</span>}
            {regionError && <span className="map-region-tip error">{regionError}</span>}
            {districtCode && !regionLoading && (
              <span className="map-region-tip">已定位，点「圈地」开始</span>
            )}
          </div>

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
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewCropId(value);
                    // 灌溉方式跟随作物，除非用户已经手动选过
                    if (!irrigationTouched) {
                      setNewIrrigationType(suggestIrrigation(cropNameOf(value)));
                    }
                  }}
                >
                  <option value="">选择作物（可选）</option>
                  {cropList.map((c) => (
                    <option key={c.id} value={c.id}>{c.cropName}</option>
                  ))}
                </select>
                <select
                  className="community-input"
                  value={newSoilType}
                  onChange={(e) => {
                    setSoilTouched(true);
                    setNewSoilType(e.target.value);
                  }}
                  aria-label="土壤类型"
                >
                  <option value="">土壤类型</option>
                  {SOIL_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  className="community-input"
                  value={newIrrigationType}
                  onChange={(e) => {
                    setIrrigationTouched(true);
                    setNewIrrigationType(e.target.value);
                  }}
                  aria-label="灌溉方式"
                >
                  <option value="">灌溉方式</option>
                  {IRRIGATION_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <label className="map-draw-plan">
                  <span>📄 {planFile ? planFile.name : '种植计划（可选）'}</span>
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.pdf,.doc,.docx"
                    hidden
                    onChange={handlePlanFile}
                  />
                  <small>{planFile ? '保存地块后自动生成任务' : '上传后按计划生成农事任务'}</small>
                </label>
              </div>
              <p className="map-draw-hint">
                土壤按圈地位置估算、灌溉按作物常用方式推荐，都可以手动修改。
              </p>
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