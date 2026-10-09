import { getWeatherInfo, formatTime, displayTemp } from '../utils/weatherCodes';

export default function CurrentWeather({ data, cityName, isCelsius }) {
  const current = data.current;
  const daily = data.daily;
  const weatherInfo = getWeatherInfo(current.weather_code);

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
