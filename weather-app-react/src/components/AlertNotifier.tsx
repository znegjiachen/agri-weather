import { useEffect, useRef } from 'react';
import { alerts } from '../api';
import { useAuth } from '../context/AuthContext';

const POLL_INTERVAL_MS = 3 * 60 * 1000;
const LAST_NOTIFIED_PREFIX = 'agri:last-notified-alert:';

interface AuthUser {
  userId?: number | string;
}

interface AuthContextValue {
  user: AuthUser | null;
}

interface AlertItem {
  id: number;
  farmlandName?: string | null;
  alertContent?: string;
  isRead?: boolean;
}

/**
 * 应用打开期间轮询未处理预警：出现比上次更新的预警且浏览器通知已授权时弹出系统通知。
 *
 * 真正关掉浏览器后的后台推送需要 Web Push + VAPID，这里只覆盖「页面还开着」的场景。
 */
export default function AlertNotifier() {
  const { user } = useAuth() as AuthContextValue;
  const storageKey = `${LAST_NOTIFIED_PREFIX}${user?.userId ?? 'anon'}`;
  const lastAlertIdRef = useRef(Number(localStorage.getItem(storageKey)) || 0);
  const initializedRef = useRef(Number(localStorage.getItem(storageKey)) > 0);

  useEffect(() => {
    let alive = true;
    const saveLastId = (id: number) => {
      lastAlertIdRef.current = id;
      localStorage.setItem(storageKey, String(id));
    };

    const notify = (fresh: AlertItem[]) => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const top = fresh[0];
      try {
        new Notification(`新的农事预警（${fresh.length} 条）`, {
          body: `${top.farmlandName ? `${top.farmlandName} · ` : ''}${top.alertContent || '请打开预警中心查看'}`,
          tag: 'agri-alert',
        });
      } catch {
        // 浏览器不支持页面内通知时忽略
      }
    };

    const poll = async () => {
      try {
        const data: AlertItem[] = await alerts.list({ status: 'active', limit: 20 });
        if (!alive) return;
        const unread = (Array.isArray(data) ? data : []).filter((item) => !item.isRead);
        const maxId = unread.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);

        if (!initializedRef.current) {
          // 首次使用只记录基线，避免把历史未读全部弹出来
          initializedRef.current = true;
          if (maxId > 0) saveLastId(maxId);
          return;
        }

        const fresh = unread
          .filter((item) => Number(item.id) > lastAlertIdRef.current)
          .sort((a, b) => Number(b.id) - Number(a.id));
        if (fresh.length === 0) return;

        saveLastId(maxId);
        notify(fresh);
      } catch {
        // 网络异常时保留基线，下一轮继续
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', poll);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [storageKey]);

  return null;
}