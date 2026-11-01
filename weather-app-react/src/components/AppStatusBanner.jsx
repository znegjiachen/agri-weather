import { useEffect, useRef, useState } from 'react';

/**
 * 全局状态提示：
 * - 离线时明确告知当前看到的是缓存数据；
 * - 有新版本 Service Worker 等待时提示更新，避免长期停留在旧版本。
 */
export default function AppStatusBanner() {
  const [offline, setOffline] = useState(() => (
    typeof navigator !== 'undefined' && navigator.onLine === false
  ));
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingRef = useRef(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let alive = true;
    let timer = null;

    const markWaiting = () => {
      waitingRef.current = true;
      setNeedRefresh(true);
    };
    const onControllerChange = () => {
      // 首次安装也会触发 controllerchange，只有等待过的新版本才需要刷新
      if (waitingRef.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    navigator.serviceWorker.ready.then((registration) => {
      if (!alive) return undefined;
      if (registration.waiting) markWaiting();
      const onUpdateFound = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            markWaiting();
          }
        });
      };
      registration.addEventListener('updatefound', onUpdateFound);
      timer = setInterval(() => {
        registration.update?.().catch(() => {});
      }, 30 * 60 * 1000);
      return undefined;
    }).catch(() => {});

    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (timer) clearInterval(timer);
    };
  }, []);

  const applyUpdate = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  if (!offline && (!needRefresh || dismissed)) return null;

  return (
    <div className="app-status" role="status">
      {offline && (
        <div className="app-status-bar offline">
          📡 当前处于离线状态，显示的是最近缓存的数据
        </div>
      )}
      {needRefresh && !dismissed && (
        <div className="app-status-bar update">
          <span>发现新版本</span>
          <button type="button" onClick={applyUpdate}>立即更新</button>
          <button
            type="button"
            className="app-status-close"
            onClick={() => setDismissed(true)}
            aria-label="稍后更新"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}