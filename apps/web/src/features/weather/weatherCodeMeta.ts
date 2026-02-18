export type WeatherTone = 'sun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export type WeatherCodeMeta = {
  label: string
  tone: WeatherTone
}

const WEATHER_CODE_META: Record<number, WeatherCodeMeta> = {
  0: { label: 'Clear', tone: 'sun' },
  1: { label: 'Mainly clear', tone: 'sun' },
  2: { label: 'Partly cloudy', tone: 'cloud' },
  3: { label: 'Overcast', tone: 'cloud' },
  45: { label: 'Fog', tone: 'fog' },
  48: { label: 'Rime fog', tone: 'fog' },
  51: { label: 'Light drizzle', tone: 'drizzle' },
  53: { label: 'Drizzle', tone: 'drizzle' },
  55: { label: 'Dense drizzle', tone: 'drizzle' },
  56: { label: 'Freezing drizzle', tone: 'drizzle' },
  57: { label: 'Dense freezing drizzle', tone: 'drizzle' },
  61: { label: 'Light rain', tone: 'rain' },
  63: { label: 'Rain', tone: 'rain' },
  65: { label: 'Heavy rain', tone: 'rain' },
  66: { label: 'Freezing rain', tone: 'rain' },
  67: { label: 'Heavy freezing rain', tone: 'rain' },
  71: { label: 'Light snow', tone: 'snow' },
  73: { label: 'Snow', tone: 'snow' },
  75: { label: 'Heavy snow', tone: 'snow' },
  77: { label: 'Snow grains', tone: 'snow' },
  80: { label: 'Rain showers', tone: 'rain' },
  81: { label: 'Heavy showers', tone: 'rain' },
  82: { label: 'Violent showers', tone: 'rain' },
  85: { label: 'Snow showers', tone: 'snow' },
  86: { label: 'Heavy snow showers', tone: 'snow' },
  95: { label: 'Thunderstorm', tone: 'storm' },
  96: { label: 'Thunder + hail', tone: 'storm' },
  99: { label: 'Severe thunder + hail', tone: 'storm' },
}

const UNKNOWN_META: WeatherCodeMeta = {
  label: 'Unknown',
  tone: 'cloud',
}

export function getWeatherCodeMeta(code: number): WeatherCodeMeta {
  return WEATHER_CODE_META[code] ?? UNKNOWN_META
}
