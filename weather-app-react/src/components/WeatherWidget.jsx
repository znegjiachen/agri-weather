import { useMediaQuery } from '../hooks/useMediaQuery';
import WeatherDesktop from './WeatherDesktop';
import MobileWeather from './MobileWeather';

/**
 * 天气页入口：
 * - 手机（≤768px）：深色沉浸式布局，参照天气 App 的移动端形态
 * - 桌面：保持原有浅色玻璃布局
 */
export default function WeatherWidget() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <MobileWeather /> : <WeatherDesktop />;
}