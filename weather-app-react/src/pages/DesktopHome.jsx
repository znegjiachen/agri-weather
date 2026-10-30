import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { farmlands, alerts as alertsApi, crops } from '../api';
import { useAuth } from '../context/AuthContext';
import { getWeatherInfo, getDayName } from '../utils/weatherCodes';
import { publishFieldContext, clearFieldContext } from '../utils/fieldContext';
import ForecastTrend from '../components/ForecastTrend';
import { alertLevelMeta, alertTypeMeta } from '../utils/alertMeta';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function todayLabel() {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日 ${now.toLocaleDateString('zh-CN', { weekday: 'long' })}`;
}

function clockLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function alertTimeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 桌面端首页驾驶舱：地块天气 + 7 日趋势 + 预警 / 农事 / 地块概况 */
export default function DesktopHome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fields, setFields] = useState([]);
  const [alertList, setAlertList] = useState([]);
  const [unread, setUnread] = useState(0);
  const [alertsCheckedAt, setAlertsCheckedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [weatherMap, setWeatherMap] = useState({});
  const [stageMap, setStageMap] = useState({});
  const [advice, setAdvice] = useState([]);
  // 渲染期间不直接读 Date.now（保持纯函数），进页面时固定一次
  const [mountedAt] = useState(() => Date.now());

  // 从天气页返回时 body 上可能还挂着 bg-sunny / bg-rainy，清掉以免驾驶舱被深色主题影响
  useEffect(() => {
    document.body.classList.remove(
      'bg-sunny', 'bg-cloudy', 'bg-rainy', 'bg-snowy', 'bg-night', 'bg-thunder', 'bg-default',
    );
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fieldList, alertData, unreadCount] = await Promise.all([
          farmlands.list(),
          alertsApi.list({ status: 'active' }),
          alertsApi.unreadCount().catch(() => 0),
        ]);
        if (!alive) return;
        setFields(fieldList);
        setAlertList(alertData);
        setUnread(unreadCount);
        if (fieldList.length > 0) {
          setSelectedId(fieldList[0].id);
        } else {
          clearFieldContext();
        }
      } catch (e) {
        if (alive) setError(e.message || '加载失败');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 每个地块的天气预报（服务端按经纬度缓存，多次调用不会重复外呼）
  useEffect(() => {
    if (fields.length === 0) return undefined;
    let alive = true;

    Promise.allSettled(fields.map((f) => farmlands.weather(f.id))).then((results) => {
      if (!alive) return;
      const next = {};
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') next[fields[index].id] = result.value;
      });
      setWeatherMap(next);
    });

    const withCrop = fields.filter((f) => f.cropId && f.plantDate);
    Promise.allSettled(withCrop.map((f) => crops.currentStage(f.cropId, f.plantDate)))
      .then((results) => {
        if (!alive) return;
        const next = {};
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value?.stageName) {
            next[withCrop[index].id] = result.value.stageName;
          }
        });
        setStageMap(next);
      });

    return () => { alive = false; };
  }, [fields]);

  // 选中地块的操作建议：今日能做 / 不能做
  useEffect(() => {
    if (!selectedId) return undefined;
    let alive = true;
    farmlands.advice(selectedId)
      .then((data) => { if (alive) setAdvice(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setAdvice([]); });
    return () => { alive = false; };
  }, [selectedId]);

  const selectedField = fields.find((f) => f.id === selectedId) || fields[0] || null;
  const selectedWeather = selectedField ? weatherMap[selectedField.id] : null;
  const current = selectedWeather?.current;
  const daily = selectedWeather?.daily;
  const currentInfo = current ? getWeatherInfo(current.weather_code) : null;
  const selectedCrop = selectedWeather?.cropName || '';
  const selectedStage = selectedField ? stageMap[selectedField.id] : '';

  // 把当前地块告诉右侧助农手，对话里问「这块地」时模型能对上号
  useEffect(() => {
    if (!selectedField) return;
    publishFieldContext({
      id: selectedField.id,
      name: selectedField.fieldName,
      cropName: selectedCrop,
      agentId: selectedField.agentId || null,
    });
  }, [selectedField, selectedCrop]);

  // 首页打开时后台刷新一次预警，避免必须进预警中心才更新
  const alertsRefreshed = useRef(false);
  useEffect(() => {
    if (fields.length === 0 || alertsRefreshed.current) return undefined;
    alertsRefreshed.current = true;
    let alive = true;
    (async () => {
      try {
        await alertsApi.refresh();
        const [data, count] = await Promise.all([
          alertsApi.list({ status: 'active' }),
          alertsApi.unreadCount(),
        ]);
        if (alive) {
          setAlertList(Array.isArray(data) ? data : []);
          setUnread(count);
          setAlertsCheckedAt(new Date());
        }
      } catch {
        // 后台刷新失败不影响首屏，已有列表继续显示
      }
    })();
    return () => { alive = false; };
  }, [fields.length]);

  // 驾驶舱只看「今天且未处理」的预警；历史记录留在预警中心
  const todayAlerts = useMemo(
    () => alertList.filter((a) => !a.isHandled && isToday(a.alertTime)),
    [alertList],
  );

  const alertCounts = useMemo(() => {
    const map = {};
    todayAlerts.forEach((a) => {
      if (!a.isHandled && a.farmlandId != null) {
        map[a.farmlandId] = (map[a.farmlandId] || 0) + 1;
      }
    });
    return map;
  }, [todayAlerts]);

  const todayAdvice = advice[0];
  const adviceBan = todayAdvice?.bans?.[0];
  const adviceTask = todayAdvice?.tasks?.join(' · ');

  const selectedAlerts = useMemo(
    () => todayAlerts.filter((a) => a.farmlandId === selectedField?.id && !a.isHandled),
    [todayAlerts, selectedField?.id],
  );
  const topSelectedAlert = useMemo(() => (
    [...selectedAlerts].sort((a, b) => alertLevelMeta(b.alertLevel).rank - alertLevelMeta(a.alertLevel).rank)[0]
  ), [selectedAlerts]);

  const trendNotes = useMemo(() => {
    if (!daily?.time?.length) return [];
    const days = daily.time.slice(0, 7).map((date, i) => ({
      date,
      high: num(daily.temperature_2m_max?.[i]),
      low: num(daily.temperature_2m_min?.[i]),
      rain: num(daily.precipitation_sum?.[i]) ?? 0,
    })).filter((d) => d.high != null && d.low != null);
    if (days.length === 0) return [];

    const notes = [];
    const rainy = days.find((d) => d.rain >= 1);
    if (rainy) {
      notes.push({ tone: 'blue', label: getDayName(rainy.date), text: `降水 ${rainy.rain.toFixed(1)} mm` });
    } else {
      notes.push({ tone: 'blue', label: '未来 7 天', text: '无有效降水' });
    }

    let drop = 0;
    let dropDay = null;
    for (let i = 0; i < days.length - 1; i += 1) {
      const diff = days[i].high - days[i + 1].high;
      if (diff > drop) {
        drop = diff;
        dropDay = days[i + 1];
      }
    }
    if (dropDay && drop >= 3) {
      notes.push({ tone: 'amber', label: getDayName(dropDay.date), text: `降温 ${Math.round(drop)}°C` });
    }

    const warmest = days.reduce((best, d) => (d.high > best.high ? d : best), days[0]);
    notes.push({ tone: 'green', label: getDayName(warmest.date), text: `最高 ${Math.round(warmest.high)}°C` });
    return notes.slice(0, 3);
  }, [daily]);

  // 按地块聚合：一块地的多条预警只占一张卡，避免同一时间刷屏
  const alertGroups = useMemo(() => {
    const groups = new Map();
    todayAlerts.forEach((a) => {
      const key = a.farmlandId ?? a.farmlandName ?? a.id;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          farmlandName: a.farmlandName || '未知地块',
          alerts: [],
          top: a,
          latest: a.alertTime,
        };
        groups.set(key, group);
      }
      group.alerts.push(a);
      if (alertLevelMeta(a.alertLevel).rank > alertLevelMeta(group.top.alertLevel).rank) {
        group.top = a;
      }
      if (new Date(a.alertTime || 0) > new Date(group.latest || 0)) group.latest = a.alertTime;
    });
    return [...groups.values()]
      .sort((a, b) => (
        alertLevelMeta(b.top.alertLevel).rank - alertLevelMeta(a.top.alertLevel).rank
        || new Date(b.latest || 0) - new Date(a.latest || 0)
      ))
      .slice(0, 3);
  }, [todayAlerts]);

  return (
    <div className="desktop-home">
      <header className="dh-topbar">
        <div className="dh-greeting">
          <h1>{greeting()}，{user?.username || '农友'}</h1>
          <p>{todayLabel()} · {selectedWeather ? `天气 ${clockLabel(current?.time) || clockLabel(new Date())}` : '正在同步天气'}{alertsCheckedAt ? ` · 预警 ${clockLabel(alertsCheckedAt)}` : ''}</p>
        </div>
        <div className="dh-actions">
          <button
            type="button"
            className="dh-icon-btn"
            onClick={() => navigate('/home/alerts')}
            title="预警中心"
          >
            🔔
            {unread > 0 && <span className="dh-badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
          <button type="button" className="dh-primary" onClick={() => navigate('/home/farmlands')}>
            ＋ 添加地块
          </button>
        </div>
      </header>

      {error && <div className="dh-error">{error}</div>}

      {loading ? (
        <div className="dh-loading">正在加载地块与天气…</div>
      ) : (
        <>
          <section className="dh-hero glass">
            <div className="dh-hero-head">
              {selectedField ? (
                <label className="dh-field-select">
                  <span className="dh-field-dot" />
                  <select
                    value={selectedId ?? ''}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                    aria-label="选择地块"
                  >
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.fieldName}
                        {weatherMap[f.id]?.cropName ? ` · ${weatherMap[f.id].cropName}` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="dh-select-caret">⌄</span>
                </label>
              ) : (
                <span className="dh-field-empty">还没有地块</span>
              )}
              {selectedStage && <span className="dh-chip green">{selectedStage}</span>}
              <span className="dh-updated">
                {selectedWeather ? '数据来源 Open-Meteo' : '天气待同步'}
              </span>
            </div>

            <div className="dh-hero-body">
              <div className="dh-now">
                <div className="dh-now-icon">
                  {currentInfo?.icon || '🌤️'}
                </div>
                <div>
                  <div className="dh-now-temp">
                    {current ? Math.round(current.temperature_2m) : '--'}
                    <span>°</span>
                  </div>
                  <div className="dh-now-cond">
                    {currentInfo?.desc || '暂无天气'}
                    {current ? ' · 实时观测' : ''}
                  </div>
                </div>
              </div>

              <div className="dh-metrics">
                <div className="dh-metric">
                  <span className="dh-metric-label">💨 风速</span>
                  <b className={current?.wind_speed_10m > 8 ? 'warn' : ''}>
                    {current ? Number(current.wind_speed_10m).toFixed(1) : '--'}
                    <small>km/h{current?.wind_speed_10m > 8 ? ' · 偏大' : ''}</small>
                  </b>
                </div>
                <div className="dh-metric">
                  <span className="dh-metric-label">🌧 降水</span>
                  <b>
                    {daily?.precipitation_sum?.[0] != null
                      ? Number(daily.precipitation_sum[0]).toFixed(1)
                      : '--'}
                    <small>mm</small>
                  </b>
                </div>
                <div className="dh-metric">
                  <span className="dh-metric-label">💧 湿度</span>
                  <b>
                    {current ? Math.round(current.relative_humidity_2m) : '--'}
                    <small>%</small>
                  </b>
                </div>
                <div className="dh-metric">
                  <span className="dh-metric-label">👁 能见度</span>
                  <b>
                    {current?.visibility != null ? (Number(current.visibility) / 1000).toFixed(0) : '--'}
                    <small>km</small>
                  </b>
                </div>
              </div>

              <div className={`dh-advice ${selectedAlerts.length > 0 || adviceBan ? 'warn' : 'ok'}`}>
                <span className="dh-advice-icon">{selectedAlerts.length > 0 || adviceBan ? '⚠️' : '🌿'}</span>
                <div>
                  {selectedAlerts.length > 0 ? (
                    <>
                      <b>{selectedAlerts.length} 条预警待处理</b>
                      <span>{alertTypeMeta(topSelectedAlert?.alertType).label} · 建议先查看预警</span>
                    </>
                  ) : (
                    <>
                      <b>{adviceBan || (adviceTask ? `适宜：${adviceTask}` : '今日暂无特别限制')}</b>
                      <span>{adviceBan ? '建议调整今天的田间作业' : '按计划作业即可'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="dh-section-head">
            <h2>
              我的地块
              <span className="dh-count">
                {fields.length} 块
                {fields.length > 0 && ` · 共 ${fields.reduce((sum, f) => sum + (Number(f.areaMu) || 0), 0).toFixed(1)} 亩`}
              </span>
            </h2>
            <button type="button" className="dh-link" onClick={() => navigate('/home/map')}>
              在地图上查看 ›
            </button>
          </div>

          <div className="dh-fields">
            {fields.map((f) => {
              const w = weatherMap[f.id];
              const info = w?.current ? getWeatherInfo(w.current.weather_code) : null;
              const rain = w?.daily?.precipitation_sum?.[0];
              const count = alertCounts[f.id] || 0;
              const stage = stageMap[f.id];
              return (
                <button
                  type="button"
                  key={f.id}
                  className={`dh-field-card glass ${f.id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(f.id)}
                >
                  <div className="dh-field-top">
                    <div>
                      <div className="dh-field-name">{f.fieldName}</div>
                      <div className="dh-field-meta">
                        {w?.cropName || '未选择作物'}
                        {f.areaMu ? ` · ${f.areaMu} 亩` : ''}
                        {stage ? ` · ${stage}` : ''}
                      </div>
                    </div>
                    <div className="dh-field-weather">
                      <span className="dh-field-icon">{info?.icon || '🌤️'}</span>
                      <div>
                        <div className="dh-field-temp">
                          {w?.current ? `${Math.round(w.current.temperature_2m)}°` : '--°'}
                        </div>
                        <div className="dh-field-cond">{info?.desc || '待同步'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dh-field-foot">
                    {count > 0 ? (
                      <span className="dh-status warn">⚠️ 今日 {count} 条预警</span>
                    ) : (
                      <span className="dh-status ok">适宜作业</span>
                    )}
                    <span>{rain != null ? `24h 降水 ${Number(rain).toFixed(1)} mm` : '—'}</span>
                  </div>
                </button>
              );
            })}

            <button type="button" className="dh-add-field" onClick={() => navigate('/home/farmlands')}>
              <span className="dh-add-plus">＋</span>
              添加地块
            </button>
          </div>

          <div className="dh-bottom">
            <section className="dh-card glass dh-trend">
              <div className="dh-card-head">
                <div>
                  <h3>未来 7 天</h3>
                  <p>最高 / 最低气温 · 降水量</p>
                </div>
                <div className="dh-legend">
                  <span><i className="high" />最高</span>
                  <span><i className="low" />最低</span>
                  <span><i className="rain" />降水</span>
                </div>
              </div>
              <div className="dh-chart">
                <ForecastTrend daily={daily} />
              </div>
              <div className="dh-trend-notes">
                {trendNotes.map((note) => (
                  <span key={`${note.label}-${note.text}`} className={`dh-note ${note.tone}`}>
                    <i />
                    <b>{note.label}</b>
                    {note.text}
                  </span>
                ))}
                <button type="button" className="dh-link" onClick={() => navigate('/home/weather')}>
                  详细预报 ›
                </button>
              </div>
            </section>

            <div className="dh-col-right">
              <section className="dh-card glass">
                <div className="dh-card-head">
                  <h3>
                    ⚠️ 预警中心
                    {todayAlerts.length > 0 && <span className="dh-count-pill">{todayAlerts.length}</span>}
                  </h3>
                  <button type="button" className="dh-link" onClick={() => navigate('/home/alerts')}>
                    全部 ›
                  </button>
                </div>

                {alertGroups.length === 0 ? (
                  <p className="dh-empty">暂无待处理预警，一切正常</p>
                ) : (
                  <div className="dh-alerts">
                    {alertGroups.map((group) => {
                      const level = alertLevelMeta(group.top.alertLevel);
                      const type = alertTypeMeta(group.top.alertType);
                      const seen = new Set();
                      const types = group.alerts.filter((a) => {
                        if (seen.has(a.alertType)) return false;
                        seen.add(a.alertType);
                        return true;
                      }).slice(0, 3);
                      return (
                        <div key={group.key} className={`dh-alert ${level.cls}`}>
                          <span className="dh-alert-icon">{type.icon}</span>
                          <div className="dh-alert-body">
                            <div className="dh-alert-title">
                              <span className="dh-alert-group-name">{group.farmlandName}</span>
                              <span className="dh-alert-group-count">{group.alerts.length} 条</span>
                            </div>
                            <div className="dh-alert-types">
                              {types.map((a) => {
                                const t = alertTypeMeta(a.alertType);
                                return (
                                  <span key={a.id} className={`dh-alert-type-chip ${alertLevelMeta(a.alertLevel).cls}`}>
                                    {t.label}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="dh-alert-meta">{group.top.alertContent}</div>
                          </div>
                          <span className="dh-alert-time">{alertTimeLabel(group.latest)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="dh-card glass">
                <div className="dh-card-head">
                  <h3>📅 今日农事</h3>
                  {selectedField && <span className="dh-card-sub">{selectedField.fieldName}</span>}
                </div>
                {!todayAdvice ? (
                  <p className="dh-empty">暂无农事建议</p>
                ) : (
                  <div className="dh-advice-list">
                    {todayAdvice.tasks?.length > 0 && (
                      <div className="dh-advice-row ok">
                        <span className="dh-advice-tag">适宜</span>
                        <span>{todayAdvice.tasks.join(' · ')}</span>
                      </div>
                    )}
                    {todayAdvice.bans?.length > 0 && (
                      <div className="dh-advice-row warn">
                        <span className="dh-advice-tag">不宜</span>
                        <span>{todayAdvice.bans.join(' · ')}</span>
                      </div>
                    )}
                    {todayAdvice.tasks?.length === 0 && todayAdvice.bans?.length === 0 && (
                      <p className="dh-empty">今日无特殊限制</p>
                    )}
                    <div className="dh-advice-foot">
                      今日最大风速 {todayAdvice.wind != null ? `${Number(todayAdvice.wind).toFixed(1)} km/h` : '—'}
                      {' · '}
                      今日降水 {todayAdvice.rain != null ? `${Number(todayAdvice.rain).toFixed(1)} mm` : '—'}
                    </div>
                  </div>
                )}
              </section>

              <section className="dh-card glass">
                <div className="dh-card-head">
                  <h3>📍 地块概况</h3>
                </div>
                {selectedField ? (
                  <div className="dh-overview">
                    <div><span>作物</span><b>{selectedCrop || '未选择'}</b></div>
                    <div><span>阶段</span><b>{selectedStage || '—'}</b></div>
                    <div><span>面积</span><b>{selectedField.areaMu ? `${selectedField.areaMu} 亩` : '—'}</b></div>
                    <div><span>土壤</span><b>{selectedField.soilType || '—'}</b></div>
                    <div><span>灌溉</span><b>{selectedField.irrigationType || '—'}</b></div>
                    <div>
                      <span>已种植</span>
                      <b>
                        {selectedField.plantDate
                          ? `${Math.max(0, Math.floor((mountedAt - new Date(`${selectedField.plantDate}T00:00:00`).getTime()) / 86400000))} 天`
                          : '—'}
                      </b>
                    </div>
                  </div>
                ) : (
                  <p className="dh-empty">添加地块后可查看作物档案</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}