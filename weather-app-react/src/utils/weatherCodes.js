const weatherCodes = {
  0: { desc: '晴朗', icon: '☀️', bg: 'sunny' },
  1: { desc: '大部晴朗', icon: '🌤️', bg: 'sunny' },
  2: { desc: '多云', icon: '⛅', bg: 'cloudy' },
  3: { desc: '阴天', icon: '☁️', bg: 'cloudy' },
  45: { desc: '雾', icon: '🌫️', bg: 'cloudy' },
  48: { desc: '雾凇', icon: '🌫️', bg: 'cloudy' },
  51: { desc: '毛毛雨', icon: '🌦️', bg: 'rainy' },
  53: { desc: '中度毛毛雨', icon: '🌦️', bg: 'rainy' },
  55: { desc: '密集毛毛雨', icon: '🌧️', bg: 'rainy' },
  61: { desc: '小雨', icon: '🌧️', bg: 'rainy' },
  63: { desc: '中雨', icon: '🌧️', bg: 'rainy' },
  65: { desc: '大雨', icon: '🌧️', bg: 'rainy' },
  71: { desc: '小雪', icon: '🌨️', bg: 'snowy' },
  73: { desc: '中雪', icon: '🌨️', bg: 'snowy' },
  75: { desc: '大雪', icon: '❄️', bg: 'snowy' },
  80: { desc: '阵雨', icon: '🌦️', bg: 'rainy' },
  81: { desc: '中度阵雨', icon: '🌧️', bg: 'rainy' },
  82: { desc: '强阵雨', icon: '🌧️', bg: 'rainy' },
  95: { desc: '雷雨', icon: '⛈️', bg: 'thunder' },
  96: { desc: '雷雨伴冰雹', icon: '⛈️', bg: 'thunder' },
  99: { desc: '强雷雨伴冰雹', icon: '⛈️', bg: 'thunder' },
};

export function getWeatherInfo(code) {
  return weatherCodes[code] || { desc: '未知', icon: '❓', bg: 'default' };
}

export function getDayName(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((date - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return '今天';
  if (diff === 1) return '明天';

  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[date.getDay()];
}

export function getHourLabel(index, timeStr) {
  if (index === 0) return '现在';
  const date = new Date(timeStr);
  return `${date.getHours()}:00`;
}

export function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function toFahrenheit(c) {
  return Math.round((c * 9) / 5 + 32);
}

export function displayTemp(c, isCelsius) {
  return isCelsius ? Math.round(c) : toFahrenheit(c);
}

export function getBackgroundClass(weatherCode, sunrise, sunset) {
  const info = getWeatherInfo(weatherCode);
  const now = new Date();
  const rise = new Date(sunrise);
  const set = new Date(sunset);

  if (now < rise || now > set) {
    if (info.bg === 'sunny' || info.bg === 'cloudy') {
      return 'bg-night';
    }
  }
  return 'bg-' + info.bg;
}
