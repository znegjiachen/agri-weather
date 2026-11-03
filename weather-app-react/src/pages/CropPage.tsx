import { useState, useEffect, useRef } from 'react';
import { crops, farmlands as farmlandApi } from '../api';
import { getFieldContext } from '../utils/fieldContext';

const round1 = (value) => Math.round(Number(value) * 10) / 10;

/** 用日出日落估算可光照时长（小时） */
function daylightHours(sunrise, sunset) {
  if (!sunrise || !sunset) return null;
  const rise = new Date(sunrise);
  const set = new Date(sunset);
  if (Number.isNaN(rise.getTime()) || Number.isNaN(set.getTime())) return null;
  const hours = (set.getTime() - rise.getTime()) / 3600000;
  return hours > 0 && hours <= 24 ? round1(hours) : null;
}

export default function CropPage() {
  const [cropList, setCropList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [stages, setStages] = useState([]);
  const [match, setMatch] = useState(null);
  const [temp, setTemp] = useState(25);
  const [humidity, setHumidity] = useState(65);
  const [rainfall, setRainfall] = useState(10);
  const [light, setLight] = useState(8);

  const [fieldList, setFieldList] = useState([]);
  const [fieldId, setFieldId] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [stageError, setStageError] = useState('');
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState('');
  const requestRef = useRef(0);
  const matchRequestRef = useRef(0);
  const selectedRef = useRef(null);

  const runMatch = async (crop, values) => {
    if (!crop) return;
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
        setMatchError(err.message || '检测失败，请稍后重试');
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
        if (alive) setLoadError(err.message || '作物列表加载失败');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey]);

  // 以首页当前选中的地块为默认数据源，没有上下文时取第一块地
  useEffect(() => {
    let alive = true;
    farmlandApi.list()
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setFieldList(list);
        if (list.length === 0) return;
        const context = getFieldContext();
        const preferred = list.find((field) => String(field.id) === String(context?.id)) || list[0];
        setFieldId(String(preferred.id));
        setWeatherLoading(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  // 地块切换后，用该地块当前气象填充检测表单默认值
  useEffect(() => {
    if (!fieldId) return undefined;
    let alive = true;
    farmlandApi.weather(fieldId)
      .then((data) => {
        if (!alive) return;
        const current = data?.current || {};
        const daily = data?.daily || {};
        const rain = Number(daily.precipitation_sum?.[0]);
        // QX/T 734 用「稳定通过」界限温度：这里用未来 5 天日均温均值近似
        const means = [];
        const days = Math.min(5, daily.time?.length || 0);
        for (let i = 0; i < days; i += 1) {
          const hi = Number(daily.temperature_2m_max?.[i]);
          const lo = Number(daily.temperature_2m_min?.[i]);
          if (Number.isFinite(hi) && Number.isFinite(lo)) means.push((hi + lo) / 2);
        }
        const fiveDayMean = means.length >= 3
          ? round1(means.reduce((sum, value) => sum + value, 0) / means.length)
          : (current.temperature_2m != null ? round1(current.temperature_2m) : null);
        const info = {
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
        // 已选作物时，换地块/天气加载完成后自动复检一次
        if (selectedRef.current) {
          runMatch(selectedRef.current, [
            info.temp ?? temp,
            info.humidity ?? humidity,
            info.rainfall ?? rainfall,
            info.light ?? light,
          ]);
        }
      })
      .catch(() => { if (alive) setWeatherInfo(null); })
      .finally(() => { if (alive) setWeatherLoading(false); });
    return () => { alive = false; };
    // 只在切换地块时重新取数；天气回填后的复检由 selectedRef 控制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError('');
    setReloadKey((value) => value + 1);
  };

  const selectCrop = async (crop) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setSelected(crop);
    selectedRef.current = crop;
    setStages([]);
    setStageError('');
    // 选中即用当前地块气象自动检测，省掉一次点击
    runMatch(crop, [temp, humidity, rainfall, light]);
    try {
      const data = await crops.stages(crop.id);
      if (requestRef.current === requestId) setStages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestRef.current === requestId) {
        setStageError(err.message || '生长阶段加载失败');
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

  const factorMeta = {
    temperature: { name: '温度', icon: '🌡️' },
    humidity: { name: '湿度', icon: '💧' },
    rainfall: { name: '降水', icon: '🌧️' },
    light: { name: '光照', icon: '☀️' },
  };
  const riskTypeMeta = { FROST: '低温冻害', HEAT: '高温热害', RAINSTORM: '强降水/涝害' };
  const factors = match
    ? ['temperature', 'humidity', 'rainfall', 'light']
      .map((key) => ({ key, ...factorMeta[key], ...match[key] }))
      .filter((factor) => factor.score != null)
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
      <p className="page-subtitle">按地块气象与作物播种界限温度，选择适合现在播种的作物</p>

      {fieldList.length > 0 && (
        <div className="glass crop-weather-bar">
          <div className="crop-weather-source">
            <span>📡 数据来源地块</span>
            <select
              value={fieldId}
              onChange={(e) => {
                setFieldId(e.target.value);
                setWeatherLoading(true);
              }}
              aria-label="选择用于气象适配的地块"
            >
              {fieldList.map((field) => (
                <option key={field.id} value={field.id}>{field.fieldName}</option>
              ))}
            </select>
          </div>

          {weatherLoading ? (
            <span className="crop-weather-hint">正在读取地块气象…</span>
          ) : weatherInfo ? (
            <div className="crop-weather-chips">
              <span>🌡 5日均温 {weatherInfo.temp ?? '--'}°C</span>
              <span>💧 {weatherInfo.humidity ?? '--'}%</span>
              <span>🌧 {weatherInfo.rainfall ?? '--'} mm</span>
              <span>☀️ {weatherInfo.light ?? '--'} h</span>
              <em>已作为默认值填入，可手动修改</em>
            </div>
          ) : (
            <span className="crop-weather-hint">该地块暂未取到气象数据，可手动填写</span>
          )}
        </div>
      )}

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
            <span>{selected ? '已按地块气象自动检测，可调整后复检' : '先选择一种作物'}</span>
          </div>
          <div className="match-form">
            <div className="match-grid">
              <label>5日均温 (°C)<input type="number" value={temp} onChange={(e) => setTemp(+e.target.value)} /></label>
              <label>湿度 (%)<input type="number" value={humidity} onChange={(e) => setHumidity(+e.target.value)} /></label>
              <label>当日降水 (mm)<input type="number" value={rainfall} onChange={(e) => setRainfall(+e.target.value)} /></label>
              <label>日照时长 (h)<input type="number" value={light} onChange={(e) => setLight(+e.target.value)} /></label>
            </div>
            <button onClick={checkMatch} disabled={!selected || matchLoading}>
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
