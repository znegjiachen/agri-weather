import { useState, useEffect, useMemo } from 'react';
import useWeather, { getSearchHistory } from '../hooks/useWeather';
import { getBackgroundClass, getWeatherInfo } from '../utils/weatherCodes';
import Header from './Header';
import UnitToggle from './UnitToggle';
import CurrentWeather from './CurrentWeather';
import WeatherDetails from './WeatherDetails';
import HourlyForecast from './HourlyForecast';
import DailyForecast from './DailyForecast';
import LoadingSpinner from './LoadingSpinner';
import ErrorPanel from './ErrorPanel';
import WeatherParticles from './WeatherParticles';

/** 桌面端天气页：保留原有浅色玻璃布局 */
export default function WeatherDesktop() {
  const [isCelsius, setIsCelsius] = useState(true);
  const { cityName, weatherData, loading, error, history, searchCity, locateUser } = useWeather();

  // 与首页天气入口保持一致：回到上次查看的城市，首次访问默认北京
  useEffect(() => { searchCity(getSearchHistory()[0] || '北京'); }, [searchCity]);

  // 天气页恢复随天气变化的背景；离开页面时还原，避免影响首页
  useEffect(() => {
    if (weatherData) {
      const code = weatherData.current.weather_code;
      document.body.className = getBackgroundClass(
        code,
        weatherData.daily.sunrise[0],
        weatherData.daily.sunset[0],
      );
    }
  }, [weatherData]);

  useEffect(() => () => { document.body.className = ''; }, []);

  const particleBg = useMemo(() => {
    if (!weatherData) return 'default';
    const { bg } = getWeatherInfo(weatherData.current.weather_code);
    return bg;
  }, [weatherData]);

  return (
    <div className="container">
      <WeatherParticles weatherCode={particleBg} />
      <Header onSearch={searchCity} onLocate={locateUser} history={history} onHistorySelect={searchCity} />
      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorPanel onRetry={() => searchCity(cityName || '北京')} />}
      {weatherData && !loading && !error && (
        <main>
          <UnitToggle isCelsius={isCelsius} onChange={setIsCelsius} />
          <CurrentWeather data={weatherData} cityName={cityName} isCelsius={isCelsius} />
          <WeatherDetails current={weatherData.current} isCelsius={isCelsius} />
          <HourlyForecast hourlyData={weatherData.hourly} isCelsius={isCelsius} />
          <DailyForecast dailyData={weatherData.daily} isCelsius={isCelsius} />
        </main>
      )}
    </div>
  );
}