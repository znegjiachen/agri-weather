import { getDayName } from '../utils/weatherCodes';

const W = 560;
const PAD_L = 36;
const PAD_R = 16;
const TOP = 28;
const BOTTOM = 186;
const RAIN_BASE = 210;

/** 用 Catmull-Rom 转三次贝塞尔，折线看起来更柔和 */
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/**
 * 未来 7 天最高/最低气温 + 降水。纯 SVG，不引入图表库。
 */
export default function ForecastTrend({ daily }) {
  const days = (daily?.time || []).slice(0, 7).map((date, i) => ({
    date,
    high: Number(daily.temperature_2m_max?.[i] ?? 0),
    low: Number(daily.temperature_2m_min?.[i] ?? 0),
    rain: Number(daily.precipitation_sum?.[i] ?? 0),
  }));

  if (days.length < 2) {
    return <p className="dh-empty">暂无预报数据</p>;
  }

  const highs = days.map((d) => d.high);
  const lows = days.map((d) => d.low);
  const min = Math.min(...lows) - 2;
  const max = Math.max(...highs) + 2;
  const span = Math.max(1, max - min);
  const step = (W - PAD_L - PAD_R) / (days.length - 1);

  const x = (i) => PAD_L + i * step;
  const y = (v) => BOTTOM - ((v - min) / span) * (BOTTOM - TOP);

  const highPoints = days.map((d, i) => ({ x: x(i), y: y(d.high) }));
  const lowPoints = days.map((d, i) => ({ x: x(i), y: y(d.low) }));
  const highPath = smoothPath(highPoints);
  const lowPath = smoothPath(lowPoints);
  const areaPath = `${highPath} L${highPoints[highPoints.length - 1].x},${RAIN_BASE - 4} L${highPoints[0].x},${RAIN_BASE - 4} Z`;

  const maxRain = Math.max(1, ...days.map((d) => d.rain));
  const gridValues = [0, 1, 2, 3].map((i) => max - (span / 3) * i);

  return (
    <svg
      className="forecast-trend"
      viewBox={`0 0 ${W} 236`}
      role="img"
      aria-label="未来 7 天天气趋势"
    >
      <defs>
        <linearGradient id="dhAreaHigh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#667eea" stopOpacity=".22" />
          <stop offset="1" stopColor="#667eea" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dhLineHigh" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#667eea" />
          <stop offset="1" stopColor="#764ba2" />
        </linearGradient>
      </defs>

      {gridValues.map((value, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            y1={y(value)}
            x2={W - PAD_R}
            y2={y(value)}
            stroke="#1f2437"
            strokeOpacity=".07"
            strokeDasharray="3 5"
          />
          <text x={PAD_L - 7} y={y(value) + 3} textAnchor="end" fontSize="9" fill="#9aa1b2">
            {Math.round(value)}°
          </text>
        </g>
      ))}

      {days.map((d, i) => {
        const height = d.rain > 0 ? 4 + (d.rain / maxRain) * 20 : 0;
        return height > 0 ? (
          <rect
            key={`r-${d.date}`}
            x={x(i) - 8}
            y={RAIN_BASE - height}
            width="16"
            height={height}
            rx="3"
            fill="#93c5fd"
            opacity=".55"
          >
            <title>{`${getDayName(d.date)} 降水 ${d.rain.toFixed(1)} mm`}</title>
          </rect>
        ) : null;
      })}

      <path d={areaPath} fill="url(#dhAreaHigh)" />
      <path d={lowPath} fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <path d={highPath} fill="none" stroke="url(#dhLineHigh)" strokeWidth="2.6" strokeLinecap="round" />

      {highPoints.map((p, i) => (
        <circle key={`h-${days[i].date}`} cx={p.x} cy={p.y} r={i === highPoints.length - 1 ? 3.8 : 3.2} fill="#fff" stroke="#667eea" strokeWidth="2">
          <title>{`${getDayName(days[i].date)} 最高 ${days[i].high}°`}</title>
        </circle>
      ))}

      {days.map((d, i) => (
        <text key={`d-${d.date}`} x={x(i)} y="230" textAnchor="middle" fontSize="10" fill={i === 0 ? '#1f2437' : '#6f7688'} fontWeight={i === 0 ? 600 : 400}>
          {getDayName(d.date)}
        </text>
      ))}
    </svg>
  );
}