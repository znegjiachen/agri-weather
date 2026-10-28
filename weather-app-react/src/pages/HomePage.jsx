import DesktopHome from './DesktopHome';
import MobileHome from './MobileHome';
import { useMediaQuery } from '../hooks/useMediaQuery';

/**
 * 首页：桌面端是驾驶舱，移动端保持原来的轮播 + 功能宫格。
 * 两套布局独立，互不影响。
 */
export default function HomePage() {
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (isMobile) {
    return <MobileHome />;
  }

  return <DesktopHome />;
}