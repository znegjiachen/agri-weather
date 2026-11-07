import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useWeather, { defaultWeatherCity } from '../hooks/useWeather';
import { useAuth } from '../context/AuthContext';
import { getWeatherInfo } from '../utils/weatherCodes';

interface AuthUser {
  region?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
}

interface HomeCurrentWeather {
  weather_code: number;
  temperature_2m: number;
}

interface HomeWeatherData {
  current?: HomeCurrentWeather;
}

interface HomeWeatherHook {
  cityName: string;
  weatherData: HomeWeatherData | null;
  loading: boolean;
  error: boolean;
  searchCity: (city: string) => void;
}

/**
 * 首页左上角的天气入口。
 *
 * 数据与天气页共用 Open-Meteo：优先显示上次查看的城市，
 * 首次使用默认北京。点击进入原天气页，页面本身不做改动。
 */
export default function HomeWeather() {
  const navigate = useNavigate();
  const { user } = useAuth() as AuthContextValue;
  const { cityName, weatherData, loading, error, searchCity } = useWeather() as HomeWeatherHook;

  useEffect(() => {
    searchCity(defaultWeatherCity(user?.region));
  }, [searchCity, user?.region]);

  const current = weatherData?.current;
  const info = current ? getWeatherInfo(current.weather_code) : null;

  if (loading) {
    return <div className="home-weather is-loading">天气加载中…</div>;
  }

  if (error || !current) {
    return (
      <button
        type="button"
        className="home-weather"
        onClick={() => navigate('/home/weather')}
      >
        🌤️ 查看天气
      </button>
    );
  }

  return (
    <button
      type="button"
      className="home-weather"
      onClick={() => navigate('/home/weather')}
      aria-label="查看天气预报"
    >
      <span className="hw-icon" aria-hidden>{info.icon}</span>
      <span className="hw-main">
        <span className="hw-row">
          <strong>{Math.round(current.temperature_2m)}°</strong>
          <span className="hw-cond">{info.desc}</span>
        </span>
        <span className="hw-city">📍 {cityName}</span>
      </span>
    </button>
  );
}