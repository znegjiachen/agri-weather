import { useState, useEffect, useMemo } from 'react';
import useWeather, { defaultWeatherCity } from '../hooks/useWeather';
import { useAuth } from '../context/AuthContext';
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

interface AuthUser {
  region?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
}

interface WeatherCurrent {
  time?: string;
  temperature_2m: number;
  weather_code: number;
  relative_humidity_2m?: number | null;
  wind_speed_10m?: number | null;
  apparent_temperature?: number | null;
  visibility?: number | null;
  surface_pressure?: number | null;
  uv_index?: number | null;
}

interface WeatherDaily {
  time: string[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
  temperature_2m_max: Array<number | null>;
  temperature_2m_min: Array<number | null>;
}

interface WeatherHourly {
  time: string[];
  weather_code: number[];
  temperature_2m: number[];
}

interface WeatherPayload {
  current: WeatherCurrent;
  daily: WeatherDaily;
  hourly: WeatherHourly;
}

interface WeatherHook {
  cityName: string;
  weatherData: WeatherPayload | null;
  loading: boolean;
  error: boolean;
  history: string[];
  updatedAt: number | null;
  locateMessage: string;
  searchCity: (city: string) => void;
  locateUser: () => void;
}

/** 桌面端天气页：保留原有浅色玻璃布局 */
export default function WeatherDesktop() {
  const [isCelsius, setIsCelsius] = useState(true);
  const { user } = useAuth() as AuthContextValue;
  const {
    cityName, weatherData, loading, error, history, updatedAt,
    locateMessage, searchCity, locateUser,
  } = useWeather() as WeatherHook;

  // 上次搜索城市 → 账号地区 → 北京
  useEffect(() => {
    searchCity(defaultWeatherCity(user?.region));
  }, [searchCity, user?.region]);

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

  const weatherCode = weatherData?.current?.weather_code;
  const particleBg = useMemo(
    () => (weatherCode == null ? 'default' : getWeatherInfo(weatherCode).bg),
    [weatherCode],
  );

  return (
    <div className="container">
      <WeatherParticles weatherCode={particleBg} />
      <Header
        onSearch={searchCity}
        onLocate={locateUser}
        history={history}
        onHistorySelect={searchCity}
        locateMessage={locateMessage}
      />
      {loading && <LoadingSpinner />}
      {error && !loading && <ErrorPanel onRetry={() => searchCity(cityName || '北京')} />}
      {weatherData && !loading && !error && (
        <main>
          <UnitToggle isCelsius={isCelsius} onChange={setIsCelsius} />
          <CurrentWeather
            data={weatherData}
            cityName={cityName}
            isCelsius={isCelsius}
            updatedAt={updatedAt}
          />
          <WeatherDetails current={weatherData.current} isCelsius={isCelsius} />
          <HourlyForecast hourlyData={weatherData.hourly} isCelsius={isCelsius} />
          <DailyForecast dailyData={weatherData.daily} isCelsius={isCelsius} />
        </main>
      )}
    </div>
  );
}