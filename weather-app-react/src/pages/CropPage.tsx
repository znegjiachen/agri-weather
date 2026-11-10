import { useState, useEffect, useRef } from 'react';
import { crops, weather } from '../api';
import { errorMessage } from '../utils/errorMessage';
import { REGION_ROOT_URL, regionUrl, fetchRegionOptions } from '../utils/regions';
import type { RegionOption } from '../utils/regions';

/** 作物档案（与后端 CropInfo 对齐） */
interface CropInfoItem {
  id: number;
  cropName?: string;
  variety?: string;
  growthCycleDays?: number | null;
  suitableTempMin?: number | null;
  suitableTempMax?: number | null;
  suitableHumidityMin?: number | null;
  suitableHumidityMax?: number | null;
  sowingPeriod?: string | null;
  sowingTempMin?: number | null;
  sowingTempMax?: number | null;
  sowingTempOptimalMin?: number | null;
  sowingTempOptimalMax?: number | null;
  frostSensitive?: boolean;
  heatSensitive?: boolean;
  waterlogSensitive?: boolean;
}

/** 地块当前气象回填值 */
interface WeatherInfo {
  temp: number | null;
  humidity: number | null;
  rainfall: number;
  light: number | null;
}

/** 单个气象因子评分（后端 report 内各因子字段） */
interface MatchFactorPayload {
  score: number;
  label?: string;
  current?: number | string;
  range?: string;
  reference?: string;
  weight?: number;
  basis?: string;
}

/** 气象适配报告中的风险项 */
interface MatchRisk {
  type: string;
  level: string;
  msg: string;
}

/** 播种气象适宜度报告（与后端 CropService.getWeatherMatch 对齐） */
interface WeatherMatchResult {
  cropName?: string;
  variety?: string;
  method?: string;
  dataNote?: string;
  temperature?: MatchFactorPayload;
  humidity?: MatchFactorPayload;
  rainfall?: MatchFactorPayload;
  light?: MatchFactorPayload;
  overallScore?: number;
  overallGrade?: string;
  finalScore: number;
  finalGrade: string;
  risks?: MatchRisk[];
  suggestions?: string[];
  hasRisk?: boolean;
}

/** 生长阶段（与后端 CropGrowthStage 对齐） */
interface GrowthStage {
  id?: number;
  stageOrder?: number;
  stageName?: string;
  stageDays?: number;
  tempMin?: number | null;
  tempMax?: number | null;
  pestRiskLevel?: string;
  keyWarnings?: string;
}

type FactorKey = 'temperature' | 'humidity' | 'rainfall' | 'light';

/** 参与展示的气象因子（分值必有） */
interface FactorView extends MatchFactorPayload {
  key: FactorKey;
  name: string;
  icon: string;
}

const round1 = (value: number | string | null | undefined) => Math.round(Number(value) * 10) / 10;

/** 用日出日落估算可光照时长（小时） */
function daylightHours(
  sunrise: string | null | undefined,
  sunset: string | null | undefined,
): number | null {
  if (!sunrise || !sunset) return null;
  const rise = new Date(sunrise);
  const set = new Date(sunset);
  if (Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime())) return null;
  const hours = (set.getTime() - rise.getTime()) / 3600000;
  return hours > 0 && hours <= 24 ? round1(hours) : null;
}

export default function CropPage() {
  const [cropList, setCropList] = useState<CropInfoItem[]>([]);
  const [selected, setSelected] = useState<CropInfoItem | null>(null);
  const [keyword, setKeyword] = useState('');
  const [stages, setStages] = useState<GrowthStage[]>([]);
  const [match, setMatch] = useState<WeatherMatchResult | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [rainfall, setRainfall] = useState<number | null>(null);
  const [light, setLight] = useState<number | null>(null);

  const [provinces, setProvinces] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<RegionOption[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const regionSeq = useRef(0);
  const weatherSeq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [stageError, setStageError] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const requestRef = useRef(0);
  const matchRequestRef = useRef(0);
  const selectedRef = useRef<CropInfoItem | null>(null);

  const runMatch = async (crop: CropInfoItem, values: Array<number | string | null>) => {
    if (!crop) return;
    if (values.some((value) => value == null || value === '' || !Number.isFinite(Number(value)))) {
      setMatchError('请先选择省份、城市和区县，自动填入气象值');
      return;
    }
    const nums = values.map(Number);
    if (nums.some((value) => !Number.isFinite(value))) {
      setMatchError('请填写有效的温度、湿度、降水和光照');
      return;
    }
    if (nums[1] < 0 || nums[1] > 100) {
      setMatchError('湿度需在 0 ~ 100% 之间');
      return;
    }
    if (nums[0] < -50 || nums[0] > 60) {
      setMatchError('温度需在 -50 ~ 60°C 之间');
      return;
    }
    if (nums[2] < 0 || nums[3] < 0 || nums[3] > 24) {
      setMatchError('降水不能为负，光照需在 0 ~ 24 小时之间');
      return;
    }

    const requestId = matchRequestRef.current + 1;
    matchRequestRef.current = requestId;
    setMatchLoading(true);
    setMatchError('');
    try {
      const data = await crops.weatherMatch(crop.id, {
        temp: nums[0],
        humidity: nums[1],
        rainfall: nums[2],
        light: nums[3],
      });
      if (matchRequestRef.current === requestId) setMatch(data);
    } catch (err) {
      if (matchRequestRef.current === requestId) {
        setMatchError(errorMessage(err, '检测失败，请稍后重试'));
      }
    } finally {
      if (matchRequestRef.current === requestId) setMatchLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    crops.list()
      .then((data) => {
        if (!alive) return;
        setCropList(Array.isArray(data) ? data : []);
        setLoadError('');
      })
      .catch((err) => {
        if (alive) setLoadError(errorMessage(err, '作物列表加载失败'));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 省份列表：播种适配按行政区划取气象，不再依赖某一块地
  useEffect(() => {
    let alive = true;
    fetchRegionOptions(REGION_ROOT_URL)
      .then((options) => { if (alive) setProvinces(options); })
      .catch(() => { if (alive) setRegionError('行政区划数据加载失败，可手动填写气象值'); });
    return () => { alive = false; };
  }, []);

  /** 把区域天气回填到检测表单；已选作物时自动复检 */
  const applyForecast = (data: any) => {
    const current = data?.current || {};
    const daily = data?.daily || {};
    const rain = Number(daily.precipitation_sum?.[0]);
    const means: number[] = [];
    const days = Math.min(5, daily.time?.length || 0);
    for (let i = 0; i < days; i += 1) {
      const hi = Number(daily.temperature_2m_max?.[i]);
      const lo = Number(daily.temperature_2m_min?.[i]);
      if (Number.isFinite(hi) && Number.isFinite(lo)) means.push((hi + lo) / 2);
    }
    const fiveDayMean = means.length >= 3
      ? round1(means.reduce((sum, value) => sum + value, 0) / means.length)
      : (current.temperature_2m != null ? round1(current.temperature_2m) : null);
    const info: WeatherInfo = {
      temp: fiveDayMean,
      humidity: current.relative_humidity_2m != null
        ? Math.round(Number(current.relative_humidity_2m)) : null,
      rainfall: Number.isFinite(rain) ? round1(rain) : 0,
      light: daylightHours(daily.sunrise?.[0], daily.sunset?.[0]),
    };
    if (info.temp != null) setTemp(info.temp);
    if (info.humidity != null) setHumidity(info.humidity);
    if (info.rainfall != null) setRainfall(info.rainfall);
    if (info.light != null) setLight(info.light);
    setWeatherInfo(info);
    const values = [info.temp, info.humidity, info.rainfall, info.light];
    if (selectedRef.current && values.every((value) => value != null)) {
      runMatch(selectedRef.current, values);
    }
  };

  const clearWeatherInputs = () => {
    setTemp(null);
    setHumidity(null);
    setRainfall(null);
    setLight(null);
  };

  const fetchRegionWeather = async (region: RegionOption) => {
    const seq = ++weatherSeq.current;
    setWeatherLoading(true);
    setWeatherInfo(null);
    setMatch(null);
    setRegionError('');
    try {
      const data = await weather.forecast(region.center[1], region.center[0]);
      if (seq !== weatherSeq.current) return;
      applyForecast(data);
    } catch (err) {
      if (seq === weatherSeq.current) {
        setRegionError(errorMessage(err, '该区域气象获取失败，可手动填写'));
      }
    } finally {
      if (seq === weatherSeq.current) setWeatherLoading(false);
    }
  };

  const handleProvinceChange = async (value: string) => {
    setProvinceCode(value);
    setCityCode('');
    setDistrictCode('');
    setCities([]);
    setDistricts([]);
    setWeatherInfo(null);
    setMatch(null);
    setRegionError('');
    weatherSeq.current += 1;
    setWeatherLoading(false);
    clearWeatherInputs();
    if (!value) return;

    const seq = ++regionSeq.current;
    setRegionLoading(true);
    try {
      const options = await fetchRegionOptions(regionUrl(Number(value)));
      if (seq !== regionSeq.current) return;
      if (options.some((item) => item.level === 'city')) {
        setCities(options);
      } else {
        // 直辖市：省下一级直接是区县
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
    setWeatherInfo(null);
    setMatch(null);
    setRegionError('');
    clearWeatherInputs();
    if (!value) return;

    const seq = ++regionSeq.current;
    setRegionLoading(true);
    try {
      const options = await fetchRegionOptions(regionUrl(Number(value)));
      if (seq !== regionSeq.current) return;
      setDistricts(options);
      const city = cities.find((item) => String(item.adcode) === value);
      if (city) await fetchRegionWeather(city);
    } catch {
      if (seq === regionSeq.current) setRegionError('该城市区县数据加载失败');
    } finally {
      if (seq === regionSeq.current) setRegionLoading(false);
    }
  };

  const handleDistrictChange = async (value: string) => {
    setDistrictCode(value);
    setRegionError('');
    setWeatherInfo(null);
    setMatch(null);
    clearWeatherInputs();
    if (!value) return;

    const district = districts.find((item) => String(item.adcode) === value);
    if (!district) return;
    await fetchRegionWeather(district);
  };

  const retryLoad = () => {
    setLoading(true);
    setLoadError('');
    setReloadKey((value) => value + 1);
  };

  const selectCrop = async (crop: CropInfoItem) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setSelected(crop);
    selectedRef.current = crop;
    setStages([]);
    setStageError('');
    // 有区域气象时选中即自动检测；没有区域时等用户选完区县再自动跑
    if (weatherInfo) runMatch(crop, [temp, humidity, rainfall, light]);
    try {
      const data = await crops.stages(crop.id);
      if (requestRef.current === requestId) {
        setStages(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (requestRef.current === requestId) {
        setStageError(errorMessage(err, '生长阶段加载失败'));
      }
    }
  };

  const checkMatch = () => {
    if (!selected) return;
    runMatch(selected, [temp, humidity, rainfall, light]);
  };

  if (loading) {
    return (
      <div className="crop-page">
        <h2 className="page-title">🌱 播种适配</h2>
        <p className="empty-text">正在加载作物数据…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="crop-page">
        <h2 className="page-title">🌱 播种适配</h2>
        <div className="glass section-card">
          <p className="empty-text">作物数据加载失败：{loadError}</p>
          <button type="button" className="btn-cancel" onClick={retryLoad}>重试</button>
        </div>
      </div>
    );
  }

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredCrops = normalizedKeyword
    ? cropList.filter((crop) => (
      `${crop.cropName}${crop.variety || ''}`.toLowerCase().includes(normalizedKeyword)
    ))
    : cropList;

  const factorMeta: Record<FactorKey, { name: string; icon: string }> = {
    temperature: { name: '温度', icon: '🌡️' },
    humidity: { name: '湿度', icon: '💧' },
    rainfall: { name: '降水', icon: '🌧️' },
    light: { name: '光照', icon: '☀️' },
  };
  const riskTypeMeta: Record<string, string> = {
    FROST: '低温冻害',
    HEAT: '高温热害',
    RAINSTORM: '强降水/涝害',
  };
  const factorKeys: FactorKey[] = ['temperature', 'humidity', 'rainfall', 'light'];
  const factors: FactorView[] = match
    ? factorKeys
      .map((key) => {
        const data = match[key];
        return data ? { key, ...factorMeta[key], ...data } : null;
      })
      .filter((factor): factor is FactorView => factor != null && factor.score != null)
    : [];
  const limiting = factors.length
    ? factors.reduce((worst, factor) => (factor.score < worst.score ? factor : worst))
    : null;
  const scoreTone = match
    ? (match.finalScore >= 80 ? 'good' : match.finalScore >= 60 ? 'warn' : 'bad')
    : '';
  const ringColor = scoreTone === 'good' ? '#22c55e'
    : scoreTone === 'warn' ? '#eab308' : '#ef4444';

  return (
    <div className="crop-page">
      <h2 className="page-title">🌱 播种适配</h2>
      <p className="page-subtitle">按所选区域的气象与作物播种界限温度，选择适合现在播种的作物</p>

      <div className="glass crop-weather-bar">
        <div className="crop-weather-source">
          <span>📍 数据来源区域</span>
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
          {regionLoading && <span className="crop-weather-hint">加载中…</span>}
        </div>

        {weatherLoading ? (
          <span className="crop-weather-hint">正在按所选区域读取气象…</span>
        ) : weatherInfo ? (
          <div className="crop-weather-chips">
            <span>🌡 5日均温 {weatherInfo.temp ?? '--'}°C</span>
            <span>💧 {weatherInfo.humidity ?? '--'}%</span>
            <span>🌧 {weatherInfo.rainfall ?? '--'} mm</span>
            <span>☀️ {weatherInfo.light ?? '--'} h</span>
            <em>已作为默认值填入，可手动修改</em>
          </div>
        ) : (
          <span className="crop-weather-hint">请选择到区县，系统按该区域取气温、湿度、降水和日照</span>
        )}
        {regionError && <span className="crop-weather-hint">{regionError}</span>}
      </div>

      <div className="grid-2col">
        <div className="glass section-card crop-picker">
          <div className="crop-picker-head">
            <h3>选择作物</h3>
            <span className="crop-picker-count">
              {normalizedKeyword ? `${filteredCrops.length} / ${cropList.length} 种` : `${cropList.length} 种`}
            </span>
          </div>

          <div className="crop-search">
            <span aria-hidden>🔍</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索作物或品种"
              aria-label="搜索作物"
            />
            {keyword && (
              <button type="button" onClick={() => setKeyword('')} aria-label="清空搜索">×</button>
            )}
          </div>

          <div className="crop-chips crop-chips-scroll">
            {filteredCrops.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`crop-chip ${selected?.id === c.id ? 'active' : ''}`}
                onClick={() => selectCrop(c)}
              >
                {c.cropName}
              </button>
            ))}
            {filteredCrops.length === 0 && (
              <p className="crop-empty">没有匹配的作物，换个关键词试试。</p>
            )}
          </div>

          {selected && (
            <div className="crop-detail">
              <div className="crop-detail-head">
                <div>
                  <h4>{selected.cropName}</h4>
                  <span>{selected.variety}</span>
                </div>
                <div className="tags">
                  {selected.frostSensitive && <span className="tag tag-danger">❄️ 怕冻</span>}
                  {selected.heatSensitive && <span className="tag tag-warning">🌡️ 怕热</span>}
                  {selected.waterlogSensitive && <span className="tag tag-info">💧 怕涝</span>}
                </div>
              </div>

              <div className="crop-specs">
                <div><span>生长周期</span><b>{selected.growthCycleDays} 天</b></div>
                <div>
                  <span>播种适温</span>
                  <b>{selected.sowingTempMin ?? '—'}–{selected.sowingTempMax ?? '—'}°C</b>
                </div>
                <div>
                  <span>最佳播温</span>
                  <b>{selected.sowingTempOptimalMin ?? '—'}–{selected.sowingTempOptimalMax ?? '—'}°C</b>
                </div>
                <div><span>生长适温</span><b>{selected.suitableTempMin}–{selected.suitableTempMax}°C</b></div>
                <div>
                  <span>适宜湿度</span>
                  <b>{selected.suitableHumidityMin}%–{selected.suitableHumidityMax}%</b>
                </div>
              </div>

              <div className="crop-sowing">
                <span>🌾 适宜播种期</span>
                <b>{selected.sowingPeriod || '暂无资料'}</b>
              </div>
            </div>
          )}
        </div>

        <div className="glass section-card match-card">
          <div className="match-card-head">
            <h3>播种条件检测</h3>
            <span>{selected ? (weatherInfo ? '已按所选区域气象自动检测，可调整后复检' : '请先选择省份、城市和区县') : '先选择区域和作物'}</span>
          </div>
          <div className="match-form">
            <div className="match-grid">
              <label>5日均温 (°C)<input type="number" value={temp ?? ''} placeholder="选择区县后自动填充" onChange={(e) => setTemp(e.target.value === '' ? null : +e.target.value)} /></label>
              <label>湿度 (%)<input type="number" value={humidity ?? ''} placeholder="选择区县后自动填充" onChange={(e) => setHumidity(e.target.value === '' ? null : +e.target.value)} /></label>
              <label>当日降水 (mm)<input type="number" value={rainfall ?? ''} placeholder="选择区县后自动填充" onChange={(e) => setRainfall(e.target.value === '' ? null : +e.target.value)} /></label>
              <label>日照时长 (h)<input type="number" value={light ?? ''} placeholder="选择区县后自动填充" onChange={(e) => setLight(e.target.value === '' ? null : +e.target.value)} /></label>
            </div>
            <button
              onClick={checkMatch}
              disabled={!selected || matchLoading || temp == null || humidity == null || rainfall == null || light == null}
            >
              {matchLoading ? '检测中…' : '重新检测'}
            </button>
          </div>

          {matchError && <div className="auth-error">{matchError}</div>}

          {match && (
            <div className={`match-result score-${match.finalScore >= 80 ? 'good' : match.finalScore >= 60 ? 'warn' : 'bad'}`}>
              <div className="match-summary">
                <div
                  className={`match-ring ${scoreTone}`}
                  style={{ background: `conic-gradient(${ringColor} ${match.finalScore}%, rgba(0,0,0,0.08) 0)` }}
                >
                  <span>{match.finalScore}</span>
                  <small>分</small>
                </div>
                <div className="match-summary-text">
                  <b className={scoreTone}>{match.finalGrade}</b>
                  {limiting && (
                    <span>
                      {limiting.score < 80
                        ? `主要限制：${limiting.name}（${limiting.score}分）`
                        : '各因子较均衡'}
                    </span>
                  )}
                  <em>{match.cropName} · 播种气象适宜度</em>
                </div>
              </div>

              <div className="match-factors">
                {factors.map((factor) => {
                  const tone = factor.score >= 85 ? 'high' : factor.score >= 70 ? 'good'
                    : factor.score >= 50 ? 'mid' : 'low';
                  return (
                    <div
                      key={factor.key}
                      className={`match-factor ${limiting?.key === factor.key && factor.score < 80 ? 'limit' : ''}`}
                    >
                      <div className="match-factor-head">
                        <span>
                          {factor.icon} {factor.name}
                          <i>权重 {factor.weight}%</i>
                        </span>
                        <b className={tone}>{factor.score}分 · {factor.label}</b>
                      </div>
                      <div className="match-factor-track">
                        <div className={tone} style={{ width: `${factor.score}%` }} />
                      </div>
                      <div className="match-factor-meta">
                        当前 {factor.current} · 适宜 {factor.range || factor.reference}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 风险警告 */}
              {match.risks && match.risks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {match.risks.map((r, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 8, marginBottom: 6, fontSize: 13,
                      background: r.level === 'RED' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                      borderLeft: '3px solid ' + (r.level === 'RED' ? '#ef4444' : '#eab308')
                    }}>
                      <span style={{ fontWeight: 600, color: r.level === 'RED' ? '#dc2626' : '#b45309' }}>
                        {r.level === 'RED' ? '🔴' : '🟡'} {riskTypeMeta[r.type] || r.type}
                      </span> {r.msg}
                    </div>
                  ))}
                </div>
              )}

              {/* 建议 */}
              {match.suggestions && match.suggestions.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(102,126,234,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💡 农事建议</div>
                  {match.suggestions.map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#555', padding: '3px 0' }}>• {s}</div>
                  ))}
                </div>
              )}

              {match.method && (
                <details className="match-method">
                  <summary>📐 算法依据与数据说明</summary>
                  <p>{match.method}</p>
                  {match.dataNote && <p>{match.dataNote}</p>}
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {stageError && (
        <div className="glass section-card" style={{ marginTop: 16 }}>
          <p className="empty-text">{stageError}</p>
        </div>
      )}

      {stages.length > 0 && (
        <div className="glass section-card" style={{ marginTop: 16 }}>
          <h3>📋 {selected?.cropName} 生长阶段</h3>
          <div className="stages-timeline">
            {stages.map((s, i) => (
              <div key={s.id ?? `${s.stageOrder}-${i}`} className={`stage-item risk-${s.pestRiskLevel?.toLowerCase()}`}>
                <div className="stage-order">{s.stageOrder}</div>
                <div className="stage-name">{s.stageName}</div>
                <div className="stage-days">{s.stageDays}天</div>
                <div className="stage-temp">{s.tempMin}~{s.tempMax}°C</div>
                {s.keyWarnings && <div className="stage-warn">⚠️ {s.keyWarnings}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
