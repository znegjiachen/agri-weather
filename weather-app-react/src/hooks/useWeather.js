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
    return {
      city: data.city || data.locality || data.principalSubdivision || '当前位置',
      region: data.locality || data.principalSubdivision || '',
    };
  } catch {
    return { city: '当前位置', region: '' };
  }
}

async function fetchWeatherData(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility,surface_pressure,uv_index&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error('Weather API error');
  return response.json();
}

async function geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=zh&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Geocoding API error');
  const data = await response.json();
  return data.results || [];
}

/** 同名地点很多（比如「长沙」会先命中重庆一个村），按行政级别 + 人口挑城市 */
function cityScore(result) {
  const feature = result?.feature_code || '';
  const weight = feature === 'PPLC' ? 5e8
    : feature === 'PPLA' ? 4e8
      : feature === 'PPLA2' ? 3e8
        : feature === 'PPLA3' ? 2e8
          : feature === 'PPLA4' ? 1e8
            : 0;
  return weight + (result?.population || 0);
}

function pickBestCity(results) {
  if (!results.length) return null;
  return [...results].sort((a, b) => cityScore(b) - cityScore(a))[0];
}

/** 空气质量单独取，失败不影响天气主流程 */
async function fetchAirQuality(lat, lon) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const aqi = data.current?.us_aqi;
    if (typeof aqi !== 'number' || Number.isNaN(aqi)) return null;
    return { aqi: Math.round(aqi), pm25: data.current?.pm2_5 ?? null };
  } catch {
    return null;
  }
}

export default function useWeather() {
  const [cityName, setCityName] = useState('');
  const [regionName, setRegionName] = useState('');
  const [weatherData, setWeatherData] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [history, setHistory] = useState(getSearchHistory);

  const fetchWeather = useCallback(async (lat, lon, city, region = '') => {
    setLoading(true);
    setError(false);

    try {
      // 天气是主数据；空气质量失败只隐藏 AQI 区块
      const [data, air] = await Promise.all([
        fetchWeatherData(lat, lon),
        fetchAirQuality(lat, lon),
      ]);
      setWeatherData(data);
      setAirQuality(air);
      setCityName(city);
      setRegionName(region);
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
      let best = pickBestCity(await geocode(city));

      // 「长沙」本身会命中重庆同名的村；补一个「市」再找一次
      const bareChineseName = /^[一-龥]{2,6}$/.test(city)
        && !/(市|县|区|镇|村)$/.test(city);
      if (bareChineseName && (!best || (best.population || 0) < 100000)) {
        const withSuffix = pickBestCity(await geocode(`${city}市`));
        if (withSuffix && cityScore(withSuffix) > cityScore(best)) {
          best = withSuffix;
        }
      }

      if (!best) {
        setError(true);
        setLoading(false);
        return;
      }

      const region = (best.admin2 && best.admin2 !== best.name ? best.admin2 : best.admin1)
        || best.country
        || '';
      await fetchWeather(best.latitude, best.longitude, best.name, region);
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
        const { city, region } = await reverseGeocode(lat, lon);
        await fetchWeather(lat, lon, city, region);
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
    regionName,
    weatherData,
    airQuality,
    loading,
    error,
    history,
    searchCity,
    locateUser,
    setError,
  };
}