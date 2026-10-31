import { useState, useEffect } from 'react';
import { farmlands, crops } from '../api';

const SOIL_TYPES = ['壤土', '沙土', '黏土', '红壤', '黑土', '盐碱土'];
const IRRIGATION_TYPES = ['漫灌', '滴灌', '喷灌', '渗灌', '雨水'];
const WEATHER_ICONS = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️', 80: '🌦️', 81: '🌧️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

/** 经纬度统一保留两位小数：两位小数约 1 公里的精度，足够定位地块 */
const roundCoord = (value) => Math.round(Number(value) * 100) / 100;

export default function FarmlandsPage() {
  const [list, setList] = useState([]);
  const [cropList, setCropList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState(null); // null / {type:'weather'|'alerts'|'advice', data, farmlandName}

  // 未填写就保持空：不要用默认土壤/灌溉或 0 代替用户没填的数据
  const [form, setForm] = useState({
    fieldName: '', lat: '', lng: '', altitude: '', areaMu: '',
    soilType: '', cropId: '', plantDate: '', irrigationType: '',
  });
  // 有边界的地块面积由服务端按多边形计算，不允许手工覆盖
  const [editHasBoundary, setEditHasBoundary] = useState(false);

  const loadList = () => {
    setListLoading(true);
    setListError('');
    farmlands.list()
      .then((data) => { setList(data); setListLoading(false); })
      .catch((err) => { setListError(err.message || '加载失败'); setListLoading(false); });
  };

  useEffect(() => {
    // 首次加载：初始 state 已是 loading，这里不再同步 setState
    let alive = true;
    farmlands.list()
      .then((data) => { if (alive) { setList(data); setListLoading(false); } })
      .catch((err) => {
        if (alive) { setListError(err.message || '加载失败'); setListLoading(false); }
      });
    crops.list().then((data) => { if (alive) setCropList(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const resetForm = () => {
    setForm({ fieldName: '', lat: '', lng: '', altitude: '', areaMu: '',
      soilType: '', cropId: '', plantDate: '', irrigationType: '' });
    setEditId(null);
    setEditHasBoundary(false);
    setShowForm(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    const body = {
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
      if (editId) await farmlands.update(editId, body);
      else await farmlands.create(body);
      loadList();
      resetForm();
    } catch (err) {
      setError(err.message || '操作失败');
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
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除该地块吗？')) return;
    try {
      await farmlands.delete(id);
      loadList();
    } catch (err) {
      setError(err.message || '删除失败');
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
      setModal({ type: action, data: { error: err.message }, farmlandName: name, loading: false });
    }
  };

  const getCropName = (cropId) => {
    const c = cropList.find((x) => x.id === cropId);
    return c ? c.cropName : '未选择';
  };

  return (
    <div className="farmlands-page">
      <div className="page-header">
        <h2 className="page-title">📍 我的地块</h2>
        <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + 添加地块
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="form-overlay" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="form-card glass-heavy">
            <h3>{editId ? '编辑地块' : '添加地块'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label>地块名称 *
                  <input type="text" value={form.fieldName} onChange={(e) => setForm({ ...form, fieldName: e.target.value })} required />
                </label>
                <label>种植作物
                  <select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
                    <option value="">-- 选择作物 --</option>
                    {cropList.map((c) => <option key={c.id} value={c.id}>{c.cropName}</option>)}
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>纬度 *（-90 ~ 90）
                  <input type="number" step="0.01" min="-90" max="90" inputMode="decimal"
                    placeholder="如 30.27" value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })} required />
                </label>
                <label>经度 *（-180 ~ 180）
                  <input type="number" step="0.01" min="-180" max="180" inputMode="decimal"
                    placeholder="如 120.15" value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: e.target.value })} required />
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
                <label>土壤类型
                  <select value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })}>
                    <option value="">未填写</option>
                    {SOIL_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>灌溉方式
                  <select value={form.irrigationType} onChange={(e) => setForm({ ...form, irrigationType: e.target.value })}>
                    <option value="">未填写</option>
                    {IRRIGATION_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label>种植日期<input type="date" value={form.plantDate} onChange={(e) => setForm({ ...form, plantDate: e.target.value })} /></label>
              <div className="form-buttons">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? '提交中...' : editId ? '保存' : '添加'}
                </button>
                <button type="button" className="btn-cancel" onClick={resetForm}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weather/Alerts/Advice Modal */}
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
          <p>🌱 还没有添加地块，点击上方按钮添加你的第一个地块吧。</p>
        </div>
      ) : (
        <div className="farmland-grid">
          {list.map((f) => (
            <div key={f.id} className="farmland-card glass">
              <div className="farmland-header">
                <h3>{f.fieldName}</h3>
                <span className="crop-badge">{getCropName(f.cropId)}</span>
              </div>
              <div className="farmland-details">
                <p>📍 {f.lat?.toFixed(2)}, {f.lng?.toFixed(2)} {f.altitude ? `海拔${f.altitude}m` : ''}</p>
                <p>
                  📐 {f.areaMu != null ? `${f.areaMu} 亩` : '面积未填'}
                  {' | '}🧱 {f.soilType || '土壤未填'}
                  {' | '}💧 {f.irrigationType || '灌溉未填'}
                </p>
                {f.plantDate && <p>🌱 播种：{f.plantDate}</p>}
              </div>
              <div className="farmland-actions">
                <button className="btn-edit" onClick={() => handleAction(f.id, f.fieldName, 'weather')}>🌤️ 天气</button>
                <button className="btn-edit" onClick={() => handleAction(f.id, f.fieldName, 'alerts')}>⚠️ 预警</button>
                <button className="btn-edit" onClick={() => handleAction(f.id, f.fieldName, 'advice')}>📋 农事</button>
                <button className="btn-edit" onClick={() => handleEdit(f)}>✏️</button>
                <button className="btn-del" onClick={() => handleDelete(f.id)} title="删除地块">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
