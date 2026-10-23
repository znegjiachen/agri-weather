import { useEffect, useState } from 'react';

/** 监听 CSS 媒体查询，用于同一路由按设备渲染两套布局 */
export function useMediaQuery(query) {
  const getMatches = () => (
    typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}