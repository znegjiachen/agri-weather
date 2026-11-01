import { useCallback, useEffect, useMemo, useState } from 'react';
import { alerts } from '../api';
import { formatCommunityTime } from '../utils/date';
import { alertLevelMeta, alertTypeMeta } from '../utils/alertMeta';
import { getPushStatus, enablePush } from '../utils/push';

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
  // 检查失败与加载失败分开：失败时不能把旧结果说成「状态正常」
  const [refreshError, setRefreshError] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [pushState, setPushState] = useState('loading');

  const notifyNewAlerts = (before, after) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const beforeIds = new Set(before.map((a) => a.id));
    const fresh = after.filter((a) => !a.isRead && !beforeIds.has(a.id));
    if (fresh.length === 0) return;
    const top = fresh.sort(
      (a, b) => alertLevelMeta(b.alertLevel).rank - alertLevelMeta(a.alertLevel).rank,
    )[0];
    try {
      new Notification(`新的农事预警（${fresh.length} 条）`, {
        body: `${top.farmlandName ? `${top.farmlandName} · ` : ''}${top.alertContent || '请打开预警中心查看'}`,
        tag: 'agri-alert',
      });
    } catch {
      // 浏览器不支持在页面内创建通知时忽略
    }
  };

  useEffect(() => {
    let alive = true;
    getPushStatus()
      .then((status) => { if (alive) setPushState(status.state); })
      .catch(() => { if (alive) setPushState('error'); });
    return () => { alive = false; };
  }, []);

  const enableNotifications = async () => {
    try {
      await enablePush();
      setPushState('subscribed');
    } catch (e) {
      setError(e.message || '开启推送失败');
    }
  };

  /**
   * 先展示已有预警，再尝试重新检查。
   * 检查失败时保留旧数据并提示「以下为上次结果」，绝不显示「暂无预警，状态正常」。
   */
  const loadAlerts = useCallback(async ({ refresh = false, silent = false } = {}) => {
    if (!silent) setLoading(true);
    if (refresh) setRefreshing(true);
    setError('');
    setRefreshError('');

    let before = [];
    try {
      const data = await alerts.list();
      before = Array.isArray(data) ? data : [];
      setList(before);
    } catch (err) {
      setError(err.message || '加载失败，请确认已登录');
    } finally {
      if (!silent) setLoading(false);
    }

    if (!refresh) {
      setRefreshing(false);
      return;
    }

    try {
      await alerts.refresh();
      const data = await alerts.list();
      const after = Array.isArray(data) ? data : [];
      setList(after);
      setError('');
      notifyNewAlerts(before, after);
    } catch (err) {
      setRefreshError(err.message || '本次检查失败，以下为上次结果');
    } finally {
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
          <p className="page-subtitle">
            按未来 24 小时天气、作物阶段和地块作物自动检查；预警由阈值推导，非官方发布，仅供参考
          </p>
        </div>
        <div className="alerts-head-actions">
          {pushState === 'available' && (
            <button type="button" className="btn-cancel" onClick={enableNotifications}>
              开启通知
            </button>
          )}
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
      {refreshError && list.length > 0 && (
        <div className="auth-notice" role="status" style={{ marginBottom: 12 }}>
          ⚠️ 本次检查失败，以下为上次结果：{refreshError}
        </div>
      )}

      {loading ? (
        <p className="empty-text">正在加载预警…</p>
      ) : filtered.length === 0 ? (
        <div className="glass alerts-empty">
          {error || refreshError ? (
            <>
              <p className="alerts-empty-icon">⚠️</p>
              <p>{refreshError || error}</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => loadAlerts({ refresh: true })}
                disabled={refreshing}
              >
                {refreshing ? '检查中…' : '重新检查'}
              </button>
            </>
          ) : (
            <>
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
            </>
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