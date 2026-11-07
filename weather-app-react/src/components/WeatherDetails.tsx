import { displayTemp } from '../utils/weatherCodes';

interface DetailsCurrent {
  relative_humidity_2m?: number | null;
  wind_speed_10m?: number | null;
  apparent_temperature?: number | null;
  visibility?: number | null;
  surface_pressure?: number | null;
  uv_index?: number | null;
}

type DetailKey = keyof DetailsCurrent;

interface DetailConfig {
  key: DetailKey;
  label: string;
  suffix?: string;
  isTemp?: boolean;
  format?: (v: number) => string;
}

interface WeatherDetailsProps {
  current: DetailsCurrent;
  isCelsius: boolean;
}

const details: DetailConfig[] = [
  { key: 'relative_humidity_2m', label: '💧 湿度', suffix: '%' },
  { key: 'wind_speed_10m', label: '💨 风速', suffix: ' km/h' },
  { key: 'apparent_temperature', label: '🌡️ 体感', suffix: '°', isTemp: true },
  {
    key: 'visibility',
    label: '👁️ 能见度',
    format: (v) => (v ? `${(v / 1000).toFixed(1)} km` : '-- km'),
  },
  {
    key: 'surface_pressure',
    label: '🔽 气压',
    format: (v) => `${Math.round(v)} hPa`,
  },
  {
    key: 'uv_index',
    label: '☀️ 紫外线',
    format: (v) => (v !== undefined ? v.toFixed(1) : '--'),
  },
];

export default function WeatherDetails({ current, isCelsius }: WeatherDetailsProps) {
  return (
    <div className="weather-details">
      {details.map((d) => {
        let value;
        if (d.format) {
          value = d.format(current[d.key]!);
        } else if (d.isTemp) {
          value = `${displayTemp(current[d.key]!, isCelsius)}${d.suffix}`;
        } else {
          value = `${current[d.key]}${d.suffix}`;
        }

        return (
          <div className="detail-card glass" key={d.key}>
            <span className="label">{d.label}</span>
            <span>{value}</span>
          </div>
        );
      })}
    </div>
  );
}
