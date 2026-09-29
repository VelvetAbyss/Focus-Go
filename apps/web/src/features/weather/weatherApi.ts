import type { TemperatureUnit } from '../../shared/prefs/preferences'
import { getWeatherCodeMeta } from './weatherCodeMeta'

export type WeatherLocation = {
  name: string
  latitude: number
  longitude: number
}

type OpenMeteoForecastResponse = {
  current?: {
    time?: string
    temperature_2m?: number
    weather_code?: number
    is_day?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    wind_speed_10m?: number
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    sunrise?: string[]
    sunset?: string[]
    precipitation_probability_max?: (number | null)[]
  }
}

type OpenMeteoGeocodeResponse = {
  results?: Array<{
    name?: string
    country?: string
    latitude?: number
    longitude?: number
  }>
}

export type WeatherDay = {
  date: string
  weatherCode: number
  condition: string
  tempMax: number
  tempMin: number
  /** Local time at the location, e.g. "2026-09-28T06:04". */
  sunrise?: string
  sunset?: string
  /** Highest hourly chance of precipitation that day, 0–100. */
  precipitationProbability?: number
}

export type WeatherCurrent = {
  /** Local time at the location, e.g. "2026-09-28T14:15". */
  time: string
  weatherCode: number
  condition: string
  temperature: number
  isDay?: boolean
  apparentTemperature?: number
  humidity?: number
  /** km/h, or mph when the temperature unit is Fahrenheit. */
  windSpeed?: number
}

export type WeatherForecast = {
  current: WeatherCurrent | null
  days: WeatherDay[]
}

const CJK_CHAR_RE = /[\u3400-\u9fff]/u

const hasCjkChar = (value: string) => CJK_CHAR_RE.test(value)

const unique = <T,>(items: T[]) => Array.from(new Set(items))

function buildCityQueryCandidates(input: string) {
  const query = input.trim()
  if (!query) return []

  const segments = query
    .split(/[，,]/g)
    .map((part) => part.trim())
    .filter(Boolean)
  const primarySegment = segments[0] ?? query

  if (!hasCjkChar(query)) {
    return unique([query, primarySegment].filter(Boolean))
  }

  const normalized = primarySegment.replace(/[省市县区州盟自治区特别行政区]/gu, '')
  const cjkChars = Array.from(normalized).filter((ch) => CJK_CHAR_RE.test(ch)).join('')
  const suffixCandidates: string[] = []

  if (cjkChars.length >= 2) suffixCandidates.push(cjkChars.slice(-2))
  if (cjkChars.length >= 3) suffixCandidates.push(cjkChars.slice(-3))

  return unique([query, primarySegment, normalized, ...suffixCandidates].filter(Boolean))
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return (await response.json()) as T
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

async function fetchGeocodeResult(cityQuery: string, language: 'en' | 'zh'): Promise<WeatherLocation | null> {
  const response = await fetchJson<OpenMeteoGeocodeResponse>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=${language}&format=json`
  )
  const match = response.results?.[0]
  if (
    !match ||
    typeof match.latitude !== 'number' ||
    typeof match.longitude !== 'number' ||
    typeof match.name !== 'string'
  ) {
    return null
  }
  return {
    name: match.country ? `${match.name}, ${match.country}` : match.name,
    latitude: match.latitude,
    longitude: match.longitude,
  }
}

export async function searchCityLocation(city: string): Promise<WeatherLocation | null> {
  const query = city.trim()
  if (!query) return null

  const candidates = buildCityQueryCandidates(query)
  const languages: Array<'en' | 'zh'> = hasCjkChar(query) ? ['zh', 'en'] : ['en', 'zh']

  for (const candidate of candidates) {
    for (const language of languages) {
      const resolved = await fetchGeocodeResult(candidate, language)
      if (resolved) return resolved
    }
  }

  return null
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<WeatherLocation | null> {
  const response = await fetchJson<OpenMeteoGeocodeResponse>(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`
  )
  const match = response.results?.[0]
  if (!match || typeof match.name !== 'string') return null
  return {
    name: match.country ? `${match.name}, ${match.country}` : match.name,
    latitude,
    longitude,
  }
}

type WttrForecastResponse = {
  current_condition?: Array<{
    temp_C?: string
    temp_F?: string
    weatherCode?: string
    localObsDateTime?: string
  }>
  weather?: Array<{
    date?: string
    maxtempC?: string
    mintempC?: string
    maxtempF?: string
    mintempF?: string
    weatherCode?: string
  }>
}

function wttrCodeToWmoCode(code: number): number {
  if (code <= 113) return 0
  if (code <= 119) return 2
  if (code <= 122) return 3
  if (code <= 260) return 45
  if (code <= 284) return 56
  if (code <= 308) return 63
  if (code <= 320) return 67
  if (code <= 338) return 73
  if (code <= 377) return 77
  if (code <= 389) return 95
  return 3
}

async function fetchThreeDayForecastFallback(
  location: WeatherLocation,
  unit: TemperatureUnit
): Promise<WeatherForecast> {
  const response = await fetchJson<WttrForecastResponse>(
    `https://wttr.in/${location.latitude},${location.longitude}?format=j1`
  )
  const days = response.weather ?? []
  if (!days.length) throw new Error('wttr.in: empty response')
  const currentCondition = response.current_condition?.[0]
  const currentWeatherCode = wttrCodeToWmoCode(parseInt(currentCondition?.weatherCode ?? '', 10))
  const currentTemperature = unit === 'fahrenheit'
    ? parseInt(currentCondition?.temp_F ?? '', 10)
    : parseInt(currentCondition?.temp_C ?? '', 10)
  const forecastDays = days.slice(0, 3).map((day) => {
    const weatherCode = wttrCodeToWmoCode(parseInt(day.weatherCode ?? '0', 10))
    const tempMax = unit === 'fahrenheit'
      ? parseInt(day.maxtempF ?? '0', 10)
      : parseInt(day.maxtempC ?? '0', 10)
    const tempMin = unit === 'fahrenheit'
      ? parseInt(day.mintempF ?? '0', 10)
      : parseInt(day.mintempC ?? '0', 10)
    return {
      date: day.date ?? '',
      weatherCode,
      condition: getWeatherCodeMeta(weatherCode).label,
      tempMax,
      tempMin,
    }
  })
  const current = Number.isFinite(currentTemperature) && currentCondition?.weatherCode
    ? {
        time: currentCondition.localObsDateTime ?? '',
        weatherCode: currentWeatherCode,
        condition: getWeatherCodeMeta(currentWeatherCode).label,
        temperature: currentTemperature,
      }
    : null

  return { current, days: forecastDays }
}

export async function fetchThreeDayForecast(
  location: WeatherLocation,
  unit: TemperatureUnit
): Promise<WeatherForecast> {
  try {
    const response = await fetchJson<OpenMeteoForecastResponse>(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,is_day,apparent_temperature,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&forecast_days=3&timezone=auto&temperature_unit=${unit}&wind_speed_unit=${unit === 'fahrenheit' ? 'mph' : 'kmh'}`
    )
    const times = response.daily?.time ?? []
    const codes = response.daily?.weather_code ?? []
    const max = response.daily?.temperature_2m_max ?? []
    const min = response.daily?.temperature_2m_min ?? []
    const sunrise = response.daily?.sunrise ?? []
    const sunset = response.daily?.sunset ?? []
    const precipitation = response.daily?.precipitation_probability_max ?? []

    const length = Math.min(times.length, codes.length, max.length, min.length)
    if (!length) throw new Error('Open-Meteo: empty forecast')
    const days = Array.from({ length }).map((_, index) => {
      const weatherCode = codes[index] ?? 0
      return {
        date: times[index],
        weatherCode,
        condition: getWeatherCodeMeta(weatherCode).label,
        tempMax: max[index] ?? 0,
        tempMin: min[index] ?? 0,
        sunrise: sunrise[index] ?? undefined,
        sunset: sunset[index] ?? undefined,
        precipitationProbability: typeof precipitation[index] === 'number' ? (precipitation[index] as number) : undefined,
      }
    })
    const currentWeatherCode = response.current?.weather_code
    const currentTemperature = response.current?.temperature_2m
    const current = typeof currentWeatherCode === 'number' && typeof currentTemperature === 'number'
      ? {
          time: response.current?.time ?? '',
          weatherCode: currentWeatherCode,
          condition: getWeatherCodeMeta(currentWeatherCode).label,
          temperature: currentTemperature,
          isDay: typeof response.current?.is_day === 'number' ? response.current.is_day === 1 : undefined,
          apparentTemperature: response.current?.apparent_temperature,
          humidity: response.current?.relative_humidity_2m,
          windSpeed: response.current?.wind_speed_10m,
        }
      : null
    return { current, days }
  } catch {
    return fetchThreeDayForecastFallback(location, unit)
  }
}
