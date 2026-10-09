import { useState, useEffect, useMemo } from 'react';
import useWeather from '../hooks/useWeather';
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

export default function WeatherWidget() {
  const [isCelsius, setIsCelsius] = useState(true);
  const { cityName, weatherData, loading, error, history, searchCity, locateUser } = useWeather();

  useEffect(() => { searchCity('北京'); }, [searchCity]);

  useEffect(() => {
    if (weatherData) {
      const code = weatherData.current.weather_code;
      const sunrise = weatherData.daily.sunrise[0];
      const sunset = weatherData.daily.sunset[0];
      document.body.className = getBackgroundClass(code, sunrise, sunset);
    }
  }, [weatherData]);

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
