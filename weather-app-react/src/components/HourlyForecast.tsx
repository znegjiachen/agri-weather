import { getWeatherInfo, getHourLabel, displayTemp } from '../utils/weatherCodes';

export default function HourlyForecast({ hourlyData, isCelsius }) {
  const now = new Date();
  const currentHour = now.getHours();
  const items = [];

  for (let i = 0; i < 24; i++) {
    const hourIndex = currentHour + i;
    if (hourIndex >= hourlyData.time.length) break;

    const timeStr = hourlyData.time[hourIndex];
    const hourInfo = getWeatherInfo(hourlyData.weather_code[hourIndex]);
    const temp = hourlyData.temperature_2m[hourIndex];

    items.push({ i, timeStr, icon: hourInfo.icon, temp });
  }

  return (
    <div className="hourly-section glass">
      <h3>24小时预报</h3>
      <div className="hourly-list">
        {items.map((item) => (
          <div className="hourly-item" key={item.i}>
            <div className="hour">{getHourLabel(item.i, item.timeStr)}</div>
            <div className="icon">{item.icon}</div>
            <div className="temp">{displayTemp(item.temp, isCelsius)}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}
