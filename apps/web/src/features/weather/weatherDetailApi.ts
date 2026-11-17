import type { TemperatureUnit } from '../../shared/prefs/preferences'
import { fetchWeatherJson, type WeatherDay, type WeatherLocation } from './weatherApi'
import { getWeatherCodeMeta } from './weatherCodeMeta'

const hourlyFields = ['temperature_2m', 'weather_code', 'is_day', 'precipitation_probability'] as const
const dailyFields = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset', 'precipitation_probability_max', 'precipitation_sum', 'uv_index_max'] as const
const currentFields = ['temperature_2m', 'weather_code', 'is_day', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'visibility', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'] as const

type Series<T extends string> = Partial<Record<T, (number | null)[]>> & { time?: string[] }
type ForecastResponse = {
  current?: Partial<Record<typeof currentFields[number], number | null>> & { time?: string }
  hourly?: Series<typeof hourlyFields[number]>
  daily?: Series<Exclude<typeof dailyFields[number], 'sunrise' | 'sunset'>> & { sunrise?: (string | null)[]; sunset?: (string | null)[] }
}

export type WeatherDetailDay = WeatherDay & { uvIndex?: number; precipitationTotal?: number }
export type WeatherHour = { time: string; temperature?: number; code?: number; daylight?: boolean; precipitation?: number }
export type DetailedWeather = {
  days: WeatherDetailDay[]
  hours: WeatherHour[]
  current: {
    time?: string
    temperature?: number
    code?: number
    daylight?: boolean
    apparent?: number
    humidity?: number
    dewPoint?: number
    visibility?: number
    pressure?: number
    wind?: number
    direction?: number
    gusts?: number
  }
}

const numeric = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const dayFlag = (value: number | null | undefined) => value === 1 ? true : value === 0 ? false : undefined
const coordinates = (location: Pick<WeatherLocation, 'latitude' | 'longitude'>) => ({
  latitude: String(location.latitude),
  longitude: String(location.longitude),
  timezone: 'auto',
})

export async function fetchWeatherDetails(location: Pick<WeatherLocation, 'latitude' | 'longitude'>, unit: TemperatureUnit, signal: AbortSignal): Promise<DetailedWeather> {
  const query = new URLSearchParams({
    ...coordinates(location),
    current: currentFields.join(','),
    hourly: hourlyFields.join(','),
    daily: dailyFields.join(','),
    forecast_days: '10',
    temperature_unit: unit,
    wind_speed_unit: unit === 'fahrenheit' ? 'mph' : 'kmh',
  })
  const response = await fetchWeatherJson<ForecastResponse>(`https://api.open-meteo.com/v1/forecast?${query}`, signal)
  const { current, daily, hourly } = response
  const days = (daily?.time ?? []).flatMap((date, index): WeatherDetailDay[] => {
    const weatherCode = numeric(daily?.weather_code?.[index])
    const tempMax = numeric(daily?.temperature_2m_max?.[index])
    const tempMin = numeric(daily?.temperature_2m_min?.[index])
    if (weatherCode === undefined || tempMax === undefined || tempMin === undefined) return []
    return [{
      date, weatherCode, tempMax, tempMin, condition: getWeatherCodeMeta(weatherCode).label,
      sunrise: daily?.sunrise?.[index] ?? undefined,
      sunset: daily?.sunset?.[index] ?? undefined,
      precipitationProbability: numeric(daily?.precipitation_probability_max?.[index]),
      precipitationTotal: numeric(daily?.precipitation_sum?.[index]),
      uvIndex: numeric(daily?.uv_index_max?.[index]),
    }]
  })
  if (!days.length) throw new Error('Open-Meteo returned no daily forecast')
  const hours = (hourly?.time ?? []).map((time, index) => ({
    time,
    temperature: numeric(hourly?.temperature_2m?.[index]),
    code: numeric(hourly?.weather_code?.[index]),
    daylight: dayFlag(hourly?.is_day?.[index]),
    precipitation: numeric(hourly?.precipitation_probability?.[index]),
  }))
  return {
    days,
    hours,
    current: {
      time: current?.time,
      temperature: numeric(current?.temperature_2m),
      code: numeric(current?.weather_code),
      daylight: dayFlag(current?.is_day),
      apparent: numeric(current?.apparent_temperature),
      humidity: numeric(current?.relative_humidity_2m),
      dewPoint: numeric(current?.dew_point_2m),
      visibility: numeric(current?.visibility),
      pressure: numeric(current?.pressure_msl),
      wind: numeric(current?.wind_speed_10m),
      direction: numeric(current?.wind_direction_10m),
      gusts: numeric(current?.wind_gusts_10m),
    },
  }
}

export async function fetchWeatherAirQuality(location: Pick<WeatherLocation, 'latitude' | 'longitude'>, signal: AbortSignal) {
  const query = new URLSearchParams({ ...coordinates(location), current: 'us_aqi,pm2_5', forecast_days: '1' })
  const response = await fetchWeatherJson<{ current?: { us_aqi?: number | null; pm2_5?: number | null } }>(`https://air-quality-api.open-meteo.com/v1/air-quality?${query}`, signal)
  return { aqi: numeric(response.current?.us_aqi), pm25: numeric(response.current?.pm2_5) }
}
