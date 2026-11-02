import { getWeatherInfo, getDayName, displayTemp } from '../utils/weatherCodes';

export default function DailyForecast({ dailyData, isCelsius }) {
  const items = [];

  for (let i = 0; i < dailyData.time.length; i++) {
    const dayInfo = getWeatherInfo(dailyData.weather_code[i]);
    items.push({
      day: getDayName(dailyData.time[i]),
      icon: dayInfo.icon,
      high: dailyData.temperature_2m_max[i],
      low: dailyData.temperature_2m_min[i],
    });
  }

  return (
    <div className="forecast-section glass">
      <h3>未来7天预报</h3>
      <div className="forecast-list">
        {items.map((item, index) => (
          <div className="forecast-item" key={index}>
            <div className="day">{item.day}</div>
            <div className="icon">{item.icon}</div>
            <div className="temp-high">{displayTemp(item.high, isCelsius)}°</div>
            <div className="temp-low">{displayTemp(item.low, isCelsius)}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}
