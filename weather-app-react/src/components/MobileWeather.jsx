import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useWeather, { getSearchHistory } from '../hooks/useWeather';
import { getBackgroundClass, getWeatherInfo, getDayName } from '../utils/weatherCodes';

function formatDate(dateStr) {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function weekdayOf(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

function aqiInfo(value) {
  if (value == null) return { label: '', pct: 0, color: '#4ade80' };
  const pct = Math.min(100, Math.max(0, (value / 300) * 100));
  if (value <= 50) return { label: '优', pct, color: '#4ade80' };
  if (value <= 100) return { label: '良', pct, color: '#facc15' };
  if (value <= 150) return { label: '轻度污染', pct, color: '#fb923c' };
  if (value <= 200) return { label: '中度污染', pct, color: '#ef4444' };
  if (value <= 300) return { label: '重度污染', pct, color: '#b91c1c' };
  return { label: '严重污染', pct: 100, color: '#7f1d1d' };
}

/** 移动端天气页：参照深色天气卡片布局，数据与桌面端一致 */
export default function MobileWeather() {
  const navigate = useNavigate();
  const {
    cityName,
    regionName,
    weatherData,
    airQuality,
    loading,
    error,
    history,
    searchCity,
    locateUser,
  } = useWeather();

  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');

  useEffect(() => {
    searchCity(getSearchHistory()[0] || '北京');
  }, [searchCity]);

  const current = weatherData?.current;
  const daily = weatherData?.daily;

  // 沿用网页端同一套天气背景渐变，同时隐藏外层子页返回栏
  const bgClass = useMemo(() => {
    if (!current || !daily) return '';
    return getBackgroundClass(current.weather_code, daily.sunrise[0], daily.sunset[0]);
  }, [current, daily]);

  useEffect(() => {
    document.body.className = `weather-mobile${bgClass ? ` ${bgClass}` : ''}`;
    return () => { document.body.className = ''; };
  }, [bgClass]);

  const today = useMemo(() => {
    if (!daily) return null;
    return {
      high: Math.round(daily.temperature_2m_max[0]),
      low: Math.round(daily.temperature_2m_min[0]),
    };
  }, [daily]);

  const days = useMemo(() => {
    if (!daily) return [];
    return daily.time.slice(1, 7).map((time, idx) => {
      const i = idx + 1;
      const info = getWeatherInfo(daily.weather_code[i]);
      return {
        time,
        day: getDayName(time),
        weekday: weekdayOf(time),
        date: formatDate(time),
        icon: info.icon,
        desc: info.desc,
        high: Math.round(daily.temperature_2m_max[i]),
        low: Math.round(daily.temperature_2m_min[i]),
      };
    });
  }, [daily]);

  const chart = useMemo(() => {
    if (days.length === 0) return null;
    const highs = days.map((d) => d.high);
    const lows = days.map((d) => d.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const span = Math.max(1, max - min);
    const n = days.length;
    const xOf = (index) => ((index + 0.5) / n) * 100;
    const yOf = (temp) => 20 + ((max - temp) / span) * 60;
    return {
      lines: days.map((_, index) => xOf(index)),
      highPoints: days.map((d, index) => `${xOf(index)},${yOf(d.high)}`).join(' '),
      lowPoints: days.map((d, index) => `${xOf(index)},${yOf(d.low)}`).join(' '),
      yOf,
    };
  }, [days]);

  const info = current ? getWeatherInfo(current.weather_code) : null;
  const aqi = airQuality?.aqi ?? null;
  const air = aqiInfo(aqi);

  const submitSearch = (value) => {
    const city = (value ?? term).trim();
    if (!city) return;
    searchCity(city);
    setSearchOpen(false);
    setTerm('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') submitSearch();
  };

  return (
    <div className="weather-page">
      <div className="weather-inner">
        <div className="wd-top">
          <button className="wd-back" onClick={() => navigate('/')} aria-label="返回">‹</button>
          <button className="wd-loc" onClick={() => setSearchOpen((v) => !v)}>
            <span className="wd-pin" aria-hidden>📍</span>
            {cityName || '选择城市'}
          </button>
          <button
            className="wd-search-toggle"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="搜索城市"
          >
            🔍
          </button>
        </div>

        {searchOpen && (
          <div className="wd-search-panel">
            <div className="wd-search-row">
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入城市名称，如 长沙"
              />
              <button onClick={() => submitSearch()}>搜索</button>
              <button
                className="ghost"
                onClick={() => {
                  setSearchOpen(false);
                  locateUser();
                }}
              >
                📍 定位
              </button>
            </div>
            {history.length > 0 && (
              <div className="wd-history">
                {history.map((city) => (
                  <button key={city} onClick={() => submitSearch(city)}>{city}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && <div className="wd-loading">正在获取天气…</div>}

        {error && !loading && (
          <div className="wd-error">
            <p>天气数据加载失败，请检查城市名称或网络</p>
            <button onClick={() => searchCity(cityName || '北京')}>重试</button>
          </div>
        )}

        {weatherData && !loading && !error && current && (
          <>
            <section className="wd-hero">
              <div className="wd-hero-text">
                <h1 className="wd-region">{regionName || cityName}</h1>
                <div className="wd-temp">{Math.round(current.temperature_2m)}<span>°</span></div>
                <div className="wd-range">
                  最高 {today.high}° / 最低 {today.low}°
                </div>
              </div>
              <div className="wd-hero-side">
                <div className="wd-icon">{info.icon}</div>
                <div className="wd-cond">{info.desc}</div>
              </div>
            </section>

            {aqi != null && (
              <section className="wd-aqi">
                <div className="wd-aqi-head">
                  <span>AQI {aqi}</span>
                  <span className="wd-aqi-label" style={{ color: air.color }}>{air.label}</span>
                </div>
                <div className="wd-aqi-bar">
                  <span className="seg s1" />
                  <span className="seg s2" />
                  <span className="seg s3" />
                  <span className="seg s4" />
                  <span className="seg s5" />
                  <span
                    className="wd-aqi-marker"
                    style={{ left: `${air.pct}%`, borderTopColor: air.color }}
                  />
                </div>
              </section>
            )}

            <section className="wd-next3">
              {days.slice(0, 3).map((day) => (
                <div className="wd-day-card" key={day.time}>
                  <div className="wd-day-icon">{day.icon}</div>
                  <div className="wd-day-name">{day.day}</div>
                  <div className="wd-day-temp">{day.high}° / {day.low}°</div>
                </div>
              ))}
            </section>

            {chart && (
              <section className="wd-week">
                <div className="wd-week-days">
                  {days.map((day) => (
                    <div className="wd-week-day" key={day.time}>
                      <div className="wd-week-name">{day.weekday}</div>
                      <div className="wd-week-date">{day.date}</div>
                      <div className="wd-week-icon">{day.icon}</div>
                      <div className="wd-week-desc">{day.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="wd-chart">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    {chart.lines.map((x, index) => (
                      <line
                        key={index}
                        x1={x}
                        y1="8"
                        x2={x}
                        y2="92"
                        className="wd-grid-line"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    <polyline
                      points={chart.highPoints}
                      className="wd-line-high"
                      vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      points={chart.lowPoints}
                      className="wd-line-low"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>

                  <div className="wd-chart-cols">
                    {days.map((day) => (
                      <div className="wd-chart-col" key={day.time}>
                        <span
                          className="wd-dot-high"
                          style={{ top: `${chart.yOf(day.high)}%` }}
                        />
                        <span
                          className="wd-dot-low"
                          style={{ top: `${chart.yOf(day.low)}%` }}
                        />
                        <span
                          className="wd-temp-high"
                          style={{ top: `${chart.yOf(day.high)}%` }}
                        >
                          {day.high}°
                        </span>
                        <span
                          className="wd-temp-low"
                          style={{ top: `${chart.yOf(day.low)}%` }}
                        >
                          {day.low}°
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <footer className="wd-attribution">天气服务由 Open-Meteo 驱动</footer>
          </>
        )}
      </div>
    </div>
  );
}