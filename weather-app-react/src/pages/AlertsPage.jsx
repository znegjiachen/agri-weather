import { useCallback, useEffect, useMemo, useState } from 'react';
import { alerts } from '../api';
import { formatCommunityTime } from '../utils/date';
import { alertLevelMeta, alertTypeMeta } from '../utils/alertMeta';

const FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 'UNREAD', label: '未读' },
  { key: 'UNHANDLED', label: '未处理' },
];

export default function AlertsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);

  const loadAlerts = useCallback(async ({ refresh = false, silent = false } = {}) => {
    if (refresh) setRefreshing(true);
    if (!silent) setLoading(true);
    setError('');
    try {
      if (refresh) await alerts.refresh();
      const data = await alerts.list();
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || '加载失败，请确认已登录');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 进入页面先自动检查全部地块，避免必须手动点地块才生成预警
  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (alive) await loadAlerts({ refresh: true });
    })();
    return () => { alive = false; };
  }, [loadAlerts]);

  const handleMarkRead = async (id) => {
    setMarkingId(id);
    try {
      await alerts.markRead(id);
      setList((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } catch (e) {
      setError(e.message || '标记失败');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkHandled = async (id) => {
    setMarkingId(id);
    try {
      await alerts.handle(id);
      setList((prev) => prev.map((a) => (
        a.id === id ? { ...a, isRead: true, isHandled: true } : a
      )));
    } catch (e) {
      setError(e.message || '标记失败');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setRefreshing(true);
    setError('');
    try {
      await alerts.markAllRead();
      await loadAlerts({ silent: true });
    } catch (e) {
      setError(e.message || '标记失败');
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    total: list.length,
    unread: list.filter((a) => !a.isRead).length,
    unhandled: list.filter((a) => !a.isHandled).length,
  }), [list]);

  const filtered = useMemo(() => {
    let items = [...list];
    if (filter === 'UNREAD') items = items.filter((a) => !a.isRead);
    if (filter === 'UNHANDLED') items = items.filter((a) => !a.isHandled);
    return items.sort((a, b) => {
      const rankDiff = alertLevelMeta(b.alertLevel).rank - alertLevelMeta(a.alertLevel).rank;
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.alertTime || 0) - new Date(a.alertTime || 0);
    });
  }, [list, filter]);

  return (
    <div className="alerts-page">
      <div className="alerts-head">
        <div>
          <h2 className="page-title">🔔 预警中心</h2>
          <p className="page-subtitle">按未来 24 小时天气、作物阶段和地块作物自动检查</p>
        </div>
        <div className="alerts-head-actions">
          {stats.unread > 0 && (
            <button type="button" className="btn-cancel" onClick={handleMarkAllRead} disabled={refreshing}>
              全部已读
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => loadAlerts({ refresh: true })}
            disabled={refreshing}
          >
            {refreshing ? '检查中…' : '检查全部地块'}
          </button>
        </div>
      </div>

      <div className="alerts-stats">
        <div className="alerts-stat glass">
          <b>{stats.total}</b>
          <span>全部预警</span>
        </div>
        <div className="alerts-stat glass">
          <b className="red">{stats.unread}</b>
          <span>未读</span>
        </div>
        <div className="alerts-stat glass">
          <b className="amber">{stats.unhandled}</b>
          <span>未处理</span>
        </div>
      </div>

      <div className="alerts-filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? 'active' : ''}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            {item.key === 'UNREAD' && stats.unread > 0 && <em>{stats.unread}</em>}
            {item.key === 'UNHANDLED' && stats.unhandled > 0 && <em>{stats.unhandled}</em>}
          </button>
        ))}
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="empty-text">正在检查地块预警…</p>
      ) : filtered.length === 0 ? (
        <div className="glass alerts-empty">
          <p className="alerts-empty-icon">{list.length === 0 ? '✅' : '🔍'}</p>
          <p>{list.length === 0 ? '暂无预警，地块状态正常' : '当前筛选下没有预警'}</p>
          {list.length === 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => loadAlerts({ refresh: true })}
              disabled={refreshing}
            >
              {refreshing ? '检查中…' : '立即检查全部地块'}
            </button>
          )}
        </div>
      ) : (
        <div className="alerts-list">
          {filtered.map((a) => {
            const level = alertLevelMeta(a.alertLevel);
            const type = alertTypeMeta(a.alertType);
            const handled = !!a.isHandled;
            return (
              <article key={a.id} className={`alert-rich level-${level.cls} ${handled ? 'handled' : ''}`}>
                <div className="alert-rich-icon" style={{ color: level.color }}>
                  {type.icon}
                </div>
                <div className="alert-rich-body">
                  <div className="alert-rich-head">
                    <span className="alert-rich-type">{type.label}</span>
                    <span
                      className="alert-rich-level"
                      style={{ color: level.color, background: `${level.color}16` }}
                    >
                      {level.label}
                    </span>
                    {a.farmlandName && (
                      <span className="alert-rich-field">
                        📍 {a.farmlandName}{a.cropName ? ` · ${a.cropName}` : ''}
                      </span>
                    )}
                    <span className="alert-rich-time">{formatCommunityTime(a.alertTime)}</span>
                  </div>

                  <p className="alert-rich-text">{a.alertContent}</p>
                  {a.suggestion && <p className="alert-rich-tip">💡 {a.suggestion}</p>}

                  <div className="alert-rich-foot">
                    <span className={`alert-status ${a.isRead ? 'read' : 'unread'}`}>
                      {a.isRead ? '已读' : '未读'}
                    </span>
                    {handled && <span className="alert-status handled">已处理</span>}
                    <div className="alert-rich-actions">
                      {!a.isRead && (
                        <button
                          type="button"
                          className="alert-action"
                          onClick={() => handleMarkRead(a.id)}
                          disabled={markingId === a.id}
                        >
                          标记已读
                        </button>
                      )}
                      {!handled && (
                        <button
                          type="button"
                          className="alert-action primary"
                          onClick={() => handleMarkHandled(a.id)}
                          disabled={markingId === a.id}
                        >
                          {markingId === a.id ? '处理中…' : '标记已处理'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}