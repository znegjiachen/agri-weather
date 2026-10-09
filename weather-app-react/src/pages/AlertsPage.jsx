import { useState, useEffect } from 'react';
import { alerts } from '../api';

const LEVEL_COLORS = { RED: '#ef4444', ORANGE: '#f97316', YELLOW: '#eab308', BLUE: '#3b82f6', GREEN: '#22c55e' };

export default function AlertsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);

  const loadAlerts = () => {
    setLoading(true);
    setError('');
    alerts.list()
      .then((data) => { setList(data); setLoading(false); })
      .catch((err) => { setError(err.message || '加载失败，请确认已登录'); setLoading(false); });
  };

  useEffect(() => { loadAlerts(); }, []);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      await alerts.markRead(id);
      setList((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch (e) { /* ignore */ }
    setMarkingId(null);
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await alerts.markAllRead();
      loadAlerts();
    } catch (e) { setError('标记失败'); }
    setLoading(false);
  };

  const unreadCount = list.filter((a) => !a.isRead).length;

  return (
    <div className="alerts-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            🔔 预警消息中心
            {unreadCount > 0 && <span className="crop-badge" style={{ marginLeft: 10, background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>{unreadCount} 条未读</span>}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button className="btn-cancel" onClick={handleMarkAllRead} style={{ padding: '8px 16px', fontSize: 13 }}>
              ✅ 全部已读
            </button>
          )}
          <button className="btn-primary" onClick={loadAlerts} style={{ fontSize: 13, padding: '8px 16px' }}>
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          {error}
          {error.includes('登录') && (
            <div style={{ marginTop: 8 }}>
              → 请先<a href="/" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>重新登录</a>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="empty-text">加载中...</p>
      ) : !error && list.length === 0 ? (
        <div className="glass section-card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 18, marginBottom: 12 }}>✅ 暂无预警</p>
          <p style={{ color: '#999', fontSize: 13 }}>
            点击地块卡片上的 <strong>⚠️ 预警</strong> 按钮即可生成预警
          </p>
        </div>
      ) : (
        <div className="alert-list">
          {list.map((a) => (
            <div
              key={a.id}
              className="alert-item glass"
              style={{
                borderLeftColor: LEVEL_COLORS[a.alertLevel] || '#999',
                opacity: a.isRead ? 0.65 : 1,
                background: a.isRead ? 'rgba(255,255,255,0.4)' : undefined,
              }}
            >
              <div className="alert-header">
                <span className="alert-level-badge" style={{ background: LEVEL_COLORS[a.alertLevel] || '#999' }}>
                  {a.alertLevel}
                </span>
                <span className="alert-type">{a.alertType}</span>
                {a.farmlandName && (
                  <span style={{ fontSize: 12, color: '#667eea', background: 'rgba(102,126,234,0.08)', padding: '2px 8px', borderRadius: 6 }}>
                    📍 {a.farmlandName}{a.cropName ? ` · ${a.cropName}` : ''}
                  </span>
                )}
                <span className="alert-time" style={{ marginLeft: 'auto' }}>{new Date(a.alertTime).toLocaleString('zh-CN')}</span>
                <span style={{ fontSize: 12, color: a.isRead ? '#999' : '#ef4444', fontWeight: 600 }}>
                  {a.isRead ? '✓ 已读' : '● 未读'}
                </span>
              </div>
              <p className="alert-content">{a.alertContent}</p>
              {a.suggestion && <p className="alert-suggestion">💡 {a.suggestion}</p>}
              {!a.isRead && (
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button
                    onClick={() => handleMarkRead(a.id)}
                    disabled={markingId === a.id}
                    style={{
                      padding: '4px 12px', border: '1px solid #667eea', borderRadius: 6,
                      background: 'rgba(102,126,234,0.06)', color: '#667eea',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    {markingId === a.id ? '...' : '✔ 标记已读'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
