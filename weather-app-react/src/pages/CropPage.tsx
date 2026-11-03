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
        const info = {
          temp: current.temperature_2m != null ? round1(current.temperature_2m) : null,
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
      })
      .catch(() => { if (alive) setWeatherInfo(null); })
      .finally(() => { if (alive) setWeatherLoading(false); });
    return () => { alive = false; };
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
    setStages([]);
    setStageError('');
    try {
      const data = await crops.stages(crop.id);
      if (requestRef.current === requestId) setStages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestRef.current === requestId) {
        setStageError(err.message || '生长阶段加载失败');
      }
    }
  };

  const checkMatch = async () => {
    if (!selected) return;
    const values = [temp, humidity, rainfall, light].map(Number);
    if (values.some((value) => !Number.isFinite(value))) {
      setMatchError('请填写有效的温度、湿度、降水和光照');
      return;
    }
    if (values[1] < 0 || values[1] > 100) {
      setMatchError('湿度需在 0 ~ 100% 之间');
      return;
    }
    if (values[0] < -50 || values[0] > 60) {
      setMatchError('温度需在 -50 ~ 60°C 之间');
      return;
    }
    if (values[2] < 0 || values[3] < 0 || values[3] > 24) {
      setMatchError('降水不能为负，光照需在 0 ~ 24 小时之间');
      return;
    }
    setMatchLoading(true);
    setMatchError('');
    try {
      const data = await crops.weatherMatch(selected.id, {
        temp: values[0],
        humidity: values[1],
        rainfall: values[2],
        light: values[3],
      });
      setMatch(data);
    } catch (err) {
      setMatchError(err.message || '检测失败，请稍后重试');
    } finally {
      setMatchLoading(false);
    }
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

  return (
    <div className="crop-page">
      <h2 className="page-title">🌱 播种适配</h2>

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
              <span>🌡 {weatherInfo.temp ?? '--'}°C</span>
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
        <div className="glass section-card">
          <h3>选择作物</h3>
          <div className="crop-chips">
            {cropList.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`crop-chip ${selected?.id === c.id ? 'active' : ''}`}
                onClick={() => selectCrop(c)}
              >
                {c.cropName}
              </button>
            ))}
          </div>

          {selected && (
            <div className="crop-detail">
              <h4>{selected.cropName}（{selected.variety}）</h4>
              <p>生长周期：{selected.growthCycleDays} 天</p>
              <p className="crop-sowing">
                🌾 适宜播种：{selected.sowingPeriod || '暂无资料'}
              </p>
              <p>适宜温度：{selected.suitableTempMin}°C ~ {selected.suitableTempMax}°C</p>
              <p>适宜湿度：{selected.suitableHumidityMin}% ~ {selected.suitableHumidityMax}%</p>
              <div className="tags">
                {selected.frostSensitive && <span className="tag tag-danger">❄️ 怕冻</span>}
                {selected.heatSensitive && <span className="tag tag-warning">🌡️ 怕热</span>}
                {selected.waterlogSensitive && <span className="tag tag-info">💧 怕涝</span>}
              </div>
            </div>
          )}
        </div>

        <div className="glass section-card">
          <h3>气象匹配检测</h3>
          <div className="match-form">
            <label>温度 (°C)<input type="number" value={temp} onChange={(e) => setTemp(+e.target.value)} /></label>
            <label>湿度 (%)<input type="number" value={humidity} onChange={(e) => setHumidity(+e.target.value)} /></label>
            <label>降水 (mm)<input type="number" value={rainfall} onChange={(e) => setRainfall(+e.target.value)} /></label>
            <label>光照 (h)<input type="number" value={light} onChange={(e) => setLight(+e.target.value)} /></label>
            <button onClick={checkMatch} disabled={!selected || matchLoading}>
              {matchLoading ? '检测中…' : '检测适配度'}
            </button>
          </div>

          {matchError && <div className="auth-error">{matchError}</div>}

          {match && (
            <div className={`match-result score-${match.finalScore >= 80 ? 'good' : match.finalScore >= 60 ? 'warn' : 'bad'}`}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div className="match-score" style={{ fontSize: 48 }}>
                  {match.finalScore}
                  <span style={{ fontSize: 16, color: '#666' }}>分</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color:
                  match.finalGrade === '优秀' ? '#16a34a' : match.finalGrade === '良好' ? '#22c55e' : match.finalGrade === '一般' ? '#eab308' : '#ef4444'
                }}>
                  {match.finalGrade}
                </div>
              </div>

              {/* 各维度评分条 */}
              {['temperature','humidity','rainfall','light'].map(key => {
                const m = match[key];
                if (!m) return null;
                return (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                      <span>{key === 'temperature' ? '🌡️ 温度' : key === 'humidity' ? '💧 湿度' : key === 'rainfall' ? '🌧️ 降水' : '☀️ 光照'}（权重{m.weight}%）</span>
                      <span style={{ fontWeight: 600, color: m.score >= 85 ? '#16a34a' : m.score >= 70 ? '#22c55e' : m.score >= 50 ? '#eab308' : '#ef4444' }}>
                        {m.score}分 {m.label}
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: m.score + '%', borderRadius: 3,
                        background: m.score >= 85 ? 'linear-gradient(90deg,#22c55e,#16a34a)' :
                                     m.score >= 70 ? 'linear-gradient(90deg,#84cc16,#22c55e)' :
                                     m.score >= 50 ? 'linear-gradient(90deg,#eab308,#f59e0b)' :
                                     'linear-gradient(90deg,#ef4444,#dc2626)',
                        transition: 'width 0.6s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>当前{m.current} | 适宜{m.range || m.reference}</div>
                  </div>
                );
              })}

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
                        {r.level === 'RED' ? '🔴' : '🟡'} {r.type}
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
