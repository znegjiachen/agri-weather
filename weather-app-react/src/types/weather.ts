/** 天气接口中前端实际使用的字段（上游 Open-Meteo / 和风天气归一化后） */
export interface CurrentWeather {
  time?: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  weather_code: number;
  visibility?: number | null;
  [key: string]: unknown;
}

export interface DailyWeather {
  time: string[];
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  [key: string]: unknown;
}

export interface WeatherData {
  current?: CurrentWeather;
  daily?: DailyWeather;
  cropName?: string;
  _source?: string;
  [key: string]: unknown;
}

export interface FarmlandAlert {
  id: number;
  farmlandId?: number | null;
  farmlandName?: string | null;
  alertType?: string;
  alertLevel?: string;
  alertContent?: string;
  alertTime?: string | null;
  isHandled?: boolean;
  [key: string]: unknown;
}

export interface FarmTask {
  id: number;
  farmlandId: number;
  farmlandName?: string;
  title: string;
  plannedDate?: string | null;
  overdue?: boolean;
  daysUntil?: number | null;
  [key: string]: unknown;
}

export interface FarmingAdvice {
  tasks?: string[];
  bans?: string[];
  wind?: number | null;
  rain?: number | null;
  [key: string]: unknown;
}
