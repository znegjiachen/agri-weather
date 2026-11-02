import { useCallback, useSyncExternalStore } from 'react';

/** 监听 CSS 媒体查询，用于同一路由按设备渲染两套布局 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  const getSnapshot = useCallback(
    (): boolean => (typeof window !== 'undefined' && window.matchMedia(query).matches),
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}