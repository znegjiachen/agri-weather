import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { farmlands, crops } from '../api';
import FarmlandCard from '../components/FarmlandCard';
import FarmlandRecordsModal from '../components/FarmlandRecordsModal';
import type { Farmland } from '../types/farmland';
import {
  SOIL_TYPES, IRRIGATION_TYPES, suggestSoil, suggestIrrigation,
} from '../utils/farmlandDefaults';
import { errorMessage } from '../utils/errorMessage';
const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

/** 经纬度统一保留两位小数：两位小数约 1 公里的精度，足够定位地块 */
const roundCoord = (value) => Math.round(Number(value) * 100) / 100;

export default function FarmlandsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Farmland[]>([]);
  const [cropList, setCropList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [stageMap, setStageMap] = useState<Record<number, string>>({});
  const [mountedAt] = useState(() => Date.now());

  // Modal state
  const [modal, setModal] = useState(null); // null / {type:'weather'|'alerts'|'advice', data, farmlandName}
  const [recordsField, setRecordsField] = useState<Farmland | null>(null);

  // 未填写就保持空：不要用默认土壤/灌溉或 0 代替用户没填的数据
  const [form, setForm] = useState({
    fieldName: '', lat: '', lng: '', altitude: '', areaMu: '',
    soilType: '', cropId: '', plantDate: '', irrigationType: '',
  });
  // 有边界的地块面积由服务端按多边形计算，不允许手工覆盖
  const [editHasBoundary, setEditHasBoundary] = useState(false);
  // 用户手动改过土壤/灌溉后，不再用推荐值覆盖
  const [soilTouched, setSoilTouched] = useState(false);
  const [irrigationTouched, setIrrigationTouched] = useState(false);

  const loadList = () => {
    setListLoading(true);
    setListError('');
    farmlands.list()
      .then((data) => { setList(data); setListLoading(false); })
      .catch((err) => { setListError(errorMessage(err, '加载失败')); setListLoading(false); });
  };

  useEffect(() => {
    // 首次加载：初始 state 已是 loading，这里不再同步 setState
    let alive = true;
    farmlands.list()
      .then((data) => { if (alive) { setList(data); setListLoading(false); } })
      .catch((err) => {
        if (alive) { setListError(errorMessage(err, '加载失败')); setListLoading(false); }
      });
    crops.list().then((data) => { if (alive) setCropList(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // 为有作物和播种日期的地块推算当前生长阶段
  useEffect(() => {
    const fields = list.filter((f) => f.cropId && f.plantDate);
    if (fields.length === 0) return undefined;
    let alive = true;
    Promise.allSettled(fields.map((f) => (
      crops.currentStage(f.cropId, f.plantDate)
        .then((stage) => ({ id: f.id, name: stage?.stageName }))
    ))).then((results) => {
      if (!alive) return;
      const next = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.name) {
          next[result.value.id] = result.value.name;
        }
      });
      setStageMap(next);
    });
    return () => { alive = false; };
  }, [list]);

  const resetForm = () => {
    setForm({ fieldName: '', lat: '', lng: '', altitude: '', areaMu: '',
      soilType: '', cropId: '', plantDate: '', irrigationType: '' });
    setEditId(null);
    setEditHasBoundary(false);
    setSoilTouched(false);
    setIrrigationTouched(false);
    setShowForm(false);
    setError('');
  };

  // 弹窗打开时支持 Esc 关闭，并锁住背景滚动
  useEffect(() => {
    if (!showForm) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowForm(false);
        setEditId(null);
        setEditHasBoundary(false);
        setError('');
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  /** 录入经纬度时按位置推荐土壤；用户手动选过就不再覆盖 */
  const updateCoordinate = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const hasLat = key === 'lat' ? value !== '' : prev.lat !== '';
      const hasLng = key === 'lng' ? value !== '' : prev.lng !== '';
      if (!soilTouched && hasLat && hasLng) {
        next.soilType = suggestSoil(Number(next.lat), Number(next.lng));
      }
      return next;
    });
  };

  /** 选作物时按作物推荐灌溉方式；用户手动选过就不再覆盖 */
  const updateCrop = (value) => {
    setForm((prev) => {
      const next = { ...prev, cropId: value };
      if (!irrigationTouched) {
        const crop = cropList.find((c) => String(c.id) === value);
        next.irrigationType = suggestIrrigation(crop?.cropName);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 新增地块统一走地图圈地，这里只处理编辑
    if (!editId) return;
    setError('');

    const lat = roundCoord(form.lat);
    const lng = roundCoord(form.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setError('纬度需在 -90 ~ 90 之间，支持两位小数（如 30.27）');
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('经度需在 -180 ~ 180 之间，支持两位小数（如 120.15）');
      return;
    }

    setLoading(true);
    const numberOrNull = (value) => (String(value).trim() === '' ? null : Number(value));
    const body: Record<string, any> = {
      fieldName: form.fieldName.trim(),
      lat,
      lng,
      altitude: numberOrNull(form.altitude),
      soilType: form.soilType || null,
      cropId: form.cropId ? parseInt(form.cropId) : null,
      plantDate: form.plantDate || null,
      irrigationType: form.irrigationType || null,
    };
    // 有边界的地块面积由后端按边界计算，手工填的值没有意义
    if (!editHasBoundary) {
      body.areaMu = numberOrNull(form.areaMu);
    }
    try {
      await farmlands.update(editId, body);
      loadList();
      resetForm();
    } catch (err) {
      setError(errorMessage(err, '操作失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (f) => {
    setForm({
      fieldName: f.fieldName || '',
      lat: f.lat != null ? Number(f.lat).toFixed(2) : '',
      lng: f.lng != null ? Number(f.lng).toFixed(2) : '',
      altitude: f.altitude?.toString() || '',
      // 历史数据里 0 亩其实是「未知」，编辑时按空值处理
      areaMu: f.areaMu != null && Number(f.areaMu) > 0 ? String(f.areaMu) : '',
      soilType: f.soilType || '', cropId: f.cropId?.toString() || '',
      plantDate: f.plantDate || '', irrigationType: f.irrigationType || '',
    });
    setEditId(f.id);
    setEditHasBoundary(!!f.boundary);
    // 已保存的土壤/灌溉保持不变；原先没填的仍允许跟随位置/作物推荐
    setSoilTouched(!!f.soilType);
    setIrrigationTouched(!!f.irrigationType);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该地块吗？')) return;
    try {
      await farmlands.delete(id);
      loadList();
    } catch (err) {
      setError(errorMessage(err, '删除失败'));
    }
  };

  const handleAction = async (id, name, action) => {
    setModal({ type: action, data: null, farmlandName: name, loading: true });
    try {
      let data;
      if (action === 'weather') data = await farmlands.weather(id);
      else if (action === 'alerts') data = await farmlands.alerts(id);
      else data = await farmlands.advice(id);
      setModal({ type: action, data, farmlandName: name, loading: false });
    } catch (err) {
      setModal({ type: action, data: { error: errorMessage(err) }, farmlandName: name, loading: false });
    }
  };

  const getCropName = (cropId) => {
    const c = cropList.find((x) => x.id === cropId);
    return c ? c.cropName : '未选择';
  };

  const daysSince = (date) => {
    if (!date) return null;
    const start = new Date(`${date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    return Math.max(0, Math.floor((mountedAt - start.getTime()) / 86400000));
  };

  const query = keyword.trim().toLowerCase();
  const filteredList = query
    ? list.filter((f) => `${f.fieldName}${getCropName(f.cropId)}`.toLowerCase().includes(query))
    : list;
  const totalArea = list.reduce((sum, f) => sum + (Number(f.areaMu) || 0), 0);
  const cropCount = new Set(list.map((f) => f.cropId).filter(Boolean)).size;

  return (
    <div className="farmlands-page">
      <div className="page-header fl-header">
        <div>
          <h2 className="page-title">📍 我的地块</h2>
          <p className="page-subtitle">
            {list.length > 0
              ? `${list.length} 块 · 共 ${totalArea.toFixed(1)} 亩`
              : '管理地块、作物与农事记录'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/home/map?draw=1')}>
          + 添加地块
        </button>
      </div>

      {list.length > 0 && (
        <div className="fl-stats">
          <div><span>地块</span><b>{list.length}</b></div>
          <div><span>总面积</span><b>{totalArea.toFixed(1)} 亩</b></div>
          <div><span>作物</span><b>{cropCount} 种</b></div>
        </div>
      )}

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="form-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div
            className="form-card glass-heavy"
            role="dialog"
            aria-modal="true"
            aria-labelledby="farmland-form-title"
          >
            <h3 id="farmland-form-title">编辑地块</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>地块名称 *
                  <input type="text" value={form.fieldName} onChange={(e) => setForm({ ...form, fieldName: e.target.value })} required />
                </label>
                <label>种植作物
                  <select value={form.cropId} onChange={(e) => updateCrop(e.target.value)}>
                    <option value="">-- 选择作物 --</option>
                    {cropList.map((c) => <option key={c.id} value={c.id}>{c.cropName}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>纬度 *（-90 ~ 90）
                  <input type="number" step="0.01" min="-90" max="90" inputMode="decimal"
                    placeholder="如 30.27" value={form.lat}
                    onChange={(e) => updateCoordinate('lat', e.target.value)} required />
                </label>
                <label>经度 *（-180 ~ 180）
                  <input type="number" step="0.01" min="-180" max="180" inputMode="decimal"
                    placeholder="如 120.15" value={form.lng}
                    onChange={(e) => updateCoordinate('lng', e.target.value)} required />
                </label>
              </div>
              <div className="form-row">
                <label>海拔 (m)<input type="number" step="any" value={form.altitude} onChange={(e) => setForm({ ...form, altitude: e.target.value })} /></label>
                <label>
                  面积 (亩){editHasBoundary ? '（由边界自动计算）' : ''}
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.areaMu}
                    onChange={(e) => setForm({ ...form, areaMu: e.target.value })}
                    disabled={editHasBoundary}
                    placeholder={editHasBoundary ? '' : '不填表示未知'}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  土壤类型 <span className="form-label-hint">（按位置估算）</span>
                  <select
                    value={form.soilType}
                    onChange={(e) => {
                      setSoilTouched(true);
                      setForm({ ...form, soilType: e.target.value });
                    }}
                  >
                    <option value="">未填写</option>
                    {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>
                  灌溉方式 <span className="form-label-hint">（按作物推荐）</span>
                  <select
                    value={form.irrigationType}
                    onChange={(e) => {
                      setIrrigationTouched(true);
                      setForm({ ...form, irrigationType: e.target.value });
                    }}
                  >
                    <option value="">未填写</option>
                    {IRRIGATION_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label>种植日期<input type="date" value={form.plantDate} onChange={(e) => setForm({ ...form, plantDate: e.target.value })} /></label>
              <div className="form-buttons">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? '提交中...' : '保存'}
                </button>
                <button type="button" className="btn-cancel" onClick={resetForm}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weather/Alerts/Advice Modal */}
      {recordsField && (
        <FarmlandRecordsModal
          farmland={recordsField}
          cropList={cropList}
          onClose={() => setRecordsField(null)}
        />
      )}

      {modal && (
        <div className="form-overlay" onClick={() => setModal(null)}>
          <div className="form-card glass-heavy" style={{ maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>
                {modal.type === 'weather' ? '🌤️ 天气预报' : modal.type === 'alerts' ? '⚠️ 气象预警' : '📋 农事建议'}
                {' - '}{modal.farmlandName}
              </h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {modal.loading && <p style={{ textAlign: 'center', padding: 40 }}>⏳ 加载中...</p>}

            {modal.data?.error && <div className="auth-error">{modal.data.error}</div>}

            {/* Weather */}
            {modal.type === 'weather' && modal.data?.current && (
              <div>
                <div style={{ textAlign: 'center', padding: 20, background: 'rgba(102,126,234,0.1)', borderRadius: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 48 }}>{WEATHER_ICONS[modal.data.current.weather_code] || '🌡️'}</div>
                  <div style={{ fontSize: 36, fontWeight: 700 }}>{modal.data.current.temperature_2m}°C</div>
                  <div style={{ color: '#666' }}>湿度 {modal.data.current.relative_humidity_2m}% | 风速 {modal.data.current.wind_speed_10m} km/h</div>
                </div>
                {modal.data.daily && (
                  <div>
                    <h4 style={{ marginBottom: 8 }}>未来7天</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8 }}>
                      {modal.data.daily.time.map((t, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: 8, background: 'rgba(255,255,255,0.5)', borderRadius: 8 }}>
                          <div style={{ fontSize: 12 }}>{t.substring(5)}</div>
                          <div style={{ fontSize: 24 }}>{WEATHER_ICONS[modal.data.daily.weather_code[i]] || '🌡️'}</div>
                          <div style={{ fontWeight: 600 }}>{modal.data.daily.temperature_2m_max[i]}°</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{modal.data.daily.temperature_2m_min[i]}°</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alerts */}
            {modal.type === 'alerts' && modal.data && (
              <div>
                {modal.data.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: 30, color: '#22c55e', fontSize: 18 }}>✅ 当前气象正常，无预警</p>
                ) : (
                  modal.data.map((a, i) => (
                    <div key={i} style={{
                      padding: 14, marginBottom: 10, borderRadius: 10,
                      borderLeft: `4px solid ${a.level === 'RED' ? '#ef4444' : a.level === 'ORANGE' ? '#f97316' : '#eab308'}`,
                      background: `rgba(${a.level === 'RED' ? '239,68,68' : a.level === 'ORANGE' ? '249,115,22' : '234,179,8'}, 0.08)`
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, color: 'white', fontSize: 12,
                          background: a.level === 'RED' ? '#ef4444' : a.level === 'ORANGE' ? '#f97316' : '#eab308'
                        }}>{a.level}</span> {a.type}
                      </div>
                      <div style={{ fontSize: 14, color: '#333' }}>{a.content}</div>
                      <div style={{ fontSize: 13, color: '#667eea', marginTop: 6 }}>💡 {a.suggestion}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Advice */}
            {modal.type === 'advice' && modal.data && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modal.data.map((day, i) => (
                  <div key={i} style={{
                    padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.5)',
                    borderLeft: i === 0 ? '4px solid #667eea' : '1px solid rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong>{day.date} {i === 0 ? '(今天)' : i === 1 ? '(明天)' : ''}</strong>
                      <span>{WEATHER_ICONS[day.weatherCode] || '🌡️'} {day.high}°/{day.low}° 💧{day.rain}mm 💨{day.wind}m/s</span>
                    </div>
                    {day.tasks.length > 0 && (
                      <div style={{ fontSize: 13 }}>✅ 适宜：{day.tasks.map(t => <span key={t} style={{ marginRight: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>{t}</span>)}</div>
                    )}
                    {day.bans.length > 0 && (
                      <div style={{ fontSize: 13, marginTop: 4 }}>🚫 禁忌：{day.bans.map(b => <span key={b} style={{ marginRight: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>{b}</span>)}</div>
                    )}
                    {day.tasks.length === 0 && day.bans.length === 0 && (
                      <div style={{ fontSize: 13, color: '#999' }}>暂无特别建议</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {listLoading ? (
        <div className="glass section-card empty-text">
          <p>⏳ 加载中...</p>
        </div>
      ) : listError ? (
        <div className="glass section-card empty-text">
          <p>⚠️ {listError}</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={loadList}>🔄 重新加载</button>
        </div>
      ) : list.length === 0 ? (
        <div className="glass section-card empty-text">
          <p>🌱 还没有添加地块，去地图上圈出第一块地吧。</p>
          <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/home/map?draw=1')}>
            去地图圈地
          </button>
        </div>
      ) : (
        <>
          <div className="fl-toolbar">
            <div className="fl-search">
              <span aria-hidden>🔍</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索地块或作物"
                aria-label="搜索地块"
              />
              {keyword && (
                <button type="button" onClick={() => setKeyword('')} aria-label="清空搜索">×</button>
              )}
            </div>
            <span className="fl-count">{filteredList.length} / {list.length} 块</span>
          </div>

          {filteredList.length === 0 ? (
            <div className="glass section-card empty-text">
              <p>没有匹配的地块，换个关键词试试。</p>
            </div>
          ) : (
            <div className="farmland-grid">
              {filteredList.map((field) => (
                <FarmlandCard
                  key={field.id}
                  field={field}
                  cropName={getCropName(field.cropId)}
                  stage={stageMap[field.id]}
                  days={daysSince(field.plantDate)}
                  onAction={(action) => handleAction(field.id, field.fieldName, action)}
                  onRecords={() => setRecordsField(field)}
                  onEdit={() => handleEdit(field)}
                  onDelete={() => handleDelete(field.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
