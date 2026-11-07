import { getWeatherInfo, formatTime, displayTemp } from '../utils/weatherCodes';

interface CurrentWeatherData {
  current: {
    time?: string;
    temperature_2m: number;
    weather_code: number;
  };
  daily: {
    sunrise: string[];
    sunset: string[];
  };
}

interface CurrentWeatherProps {
  data: CurrentWeatherData;
  cityName: string;
  isCelsius: boolean;
  updatedAt: number | null;
}

export default function CurrentWeather({
  data, cityName, isCelsius, updatedAt,
}: CurrentWeatherProps) {
  const current = data.current;
  const daily = data.daily;
  const weatherInfo = getWeatherInfo(current.weather_code);
  const observedAt = current.time ? new Date(current.time) : (updatedAt ? new Date(updatedAt) : null);
  const updatedLabel = observedAt && !Number.isNaN(observedAt.getTime())
    ? observedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="current-weather glass">
      <h2>{cityName}</h2>
      <p id="currentDate">
        {new Date().toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}
        {updatedLabel ? ` · ${updatedLabel} 观测` : ''}
      </p>
      <div className="weather-main">
        <div className="weather-icon">{weatherInfo.icon}</div>
        <div className="temperature">
          <span>{displayTemp(current.temperature_2m, isCelsius)}</span>
          <span className="unit">{isCelsius ? '°C' : '°F'}</span>
        </div>
      </div>
      <p id="weatherDesc">{weatherInfo.desc}</p>
      <div className="sun-info">
        <span>🌅 {formatTime(daily.sunrise[0])}</span>
        <span>🌇 {formatTime(daily.sunset[0])}</span>
      </div>
    </div>
  );
}
