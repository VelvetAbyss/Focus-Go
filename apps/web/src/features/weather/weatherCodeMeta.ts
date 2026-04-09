export type WeatherTone = 'sun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export type WeatherCodeMeta = {
  label: string
  labelZh: string
  tone: WeatherTone
}

const WEATHER_CODE_META: Record<number, WeatherCodeMeta> = {
  0:  { label: 'Clear',                      labelZh: '晴天',       tone: 'sun' },
  1:  { label: 'Mainly clear',               labelZh: '大致晴朗',   tone: 'sun' },
  2:  { label: 'Partly cloudy',              labelZh: '局部多云',   tone: 'cloud' },
  3:  { label: 'Overcast',                   labelZh: '阴天',       tone: 'cloud' },
  45: { label: 'Fog',                        labelZh: '雾',         tone: 'fog' },
  48: { label: 'Rime fog',                   labelZh: '雾凇',       tone: 'fog' },
  51: { label: 'Light drizzle',              labelZh: '小毛毛雨',   tone: 'drizzle' },
  53: { label: 'Drizzle',                    labelZh: '毛毛雨',     tone: 'drizzle' },
  55: { label: 'Dense drizzle',              labelZh: '浓毛毛雨',   tone: 'drizzle' },
  56: { label: 'Freezing drizzle',           labelZh: '冻毛毛雨',   tone: 'drizzle' },
  57: { label: 'Dense freezing drizzle',     labelZh: '浓冻毛毛雨', tone: 'drizzle' },
  61: { label: 'Light rain',                 labelZh: '小雨',       tone: 'rain' },
  63: { label: 'Rain',                       labelZh: '中雨',       tone: 'rain' },
  65: { label: 'Heavy rain',                 labelZh: '大雨',       tone: 'rain' },
  66: { label: 'Freezing rain',              labelZh: '冻雨',       tone: 'rain' },
  67: { label: 'Heavy freezing rain',        labelZh: '大冻雨',     tone: 'rain' },
  71: { label: 'Light snow',                 labelZh: '小雪',       tone: 'snow' },
  73: { label: 'Snow',                       labelZh: '中雪',       tone: 'snow' },
  75: { label: 'Heavy snow',                 labelZh: '大雪',       tone: 'snow' },
  77: { label: 'Snow grains',                labelZh: '雪粒',       tone: 'snow' },
  80: { label: 'Showers',                    labelZh: '阵雨',       tone: 'rain' },
  81: { label: 'Heavy showers',              labelZh: '大阵雨',     tone: 'rain' },
  82: { label: 'Violent showers',            labelZh: '暴雨',       tone: 'rain' },
  85: { label: 'Snow showers',               labelZh: '阵雪',       tone: 'snow' },
  86: { label: 'Heavy snow showers',         labelZh: '大阵雪',     tone: 'snow' },
  95: { label: 'Thunderstorm',               labelZh: '雷暴',       tone: 'storm' },
  96: { label: 'Thunder + hail',             labelZh: '雷暴夹冰雹', tone: 'storm' },
  99: { label: 'Severe thunder + hail',      labelZh: '强雷暴夹冰雹', tone: 'storm' },
}

const UNKNOWN_META: WeatherCodeMeta = {
  label: 'Unknown',
  labelZh: '未知',
  tone: 'cloud',
}

export function getWeatherCodeMeta(code: number): WeatherCodeMeta {
  return WEATHER_CODE_META[code] ?? UNKNOWN_META
}
