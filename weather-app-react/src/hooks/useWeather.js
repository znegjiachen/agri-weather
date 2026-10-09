import { useState, useCallback } from 'react';

const HISTORY_KEY = 'weather_search_history';
const MAX_HISTORY = 6;

export function getSearchHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(city) {
  if (!city || city === '当前位置') return;
  let history = getSearchHistory();
  history = history.filter((c) => c !== city);
  history.unshift(city);
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Reverse geocoding failed');
    const data = await response.json();
    return data.city || data.locality || data.principalSubdivision || '当前位置';
  } catch {
    return '当前位置';
  }
}

async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility,surface_pressure,uv_index&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather API error');
  return response.json();
}

export default function useWeather() {
  const [cityName, setCityName] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(getSearchHistory);

  const fetchWeather = useCallback(async (lat, lon, city) => {
    setLoading(true);
    setError(false);

    try {
      const data = await fetchWeatherData(lat, lon);
      setWeatherData(data);
      setCityName(city);
      saveSearchHistory(city);
      setHistory(getSearchHistory());
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchCity = useCallback(async (city) => {
    if (!city) return;

    setLoading(true);
    setError(false);

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Geocoding API error');

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        setError(true);
        setLoading(false);
        return;
      }

      const result = data.results[0];
      await fetchWeather(result.latitude, result.longitude, result.name);
    } catch (err) {
      console.error(err);
      setError(true);
      setLoading(false);
    }
  }, [fetchWeather]);

  const locateUser = useCallback(async () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持地理定位');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const city = await reverseGeocode(lat, lon);
        await fetchWeather(lat, lon, city);
      },
      () => {
        alert('无法获取您的位置，请检查定位权限后重试');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [fetchWeather]);

  return {
    cityName,
    weatherData,
    loading,
    error,
    history,
    searchCity,
    locateUser,
    setError,
  };
}
