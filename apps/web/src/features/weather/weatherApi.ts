import type { TemperatureUnit } from '../../shared/prefs/preferences'
import { getWeatherCodeMeta } from './weatherCodeMeta'

export type WeatherLocation = {
  name: string
  latitude: number
  longitude: number
}

type OpenMeteoForecastResponse = {
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
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
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timeout)
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

export async function fetchThreeDayForecast(
  location: WeatherLocation,
  unit: TemperatureUnit
): Promise<WeatherDay[]> {
  const response = await fetchJson<OpenMeteoForecastResponse>(
    `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto&temperature_unit=${unit}`
  )
  const times = response.daily?.time ?? []
  const codes = response.daily?.weather_code ?? []
  const max = response.daily?.temperature_2m_max ?? []
  const min = response.daily?.temperature_2m_min ?? []

  const length = Math.min(times.length, codes.length, max.length, min.length)
  return Array.from({ length }).map((_, index) => {
    const weatherCode = codes[index] ?? 0
    return {
      date: times[index],
      weatherCode,
      condition: getWeatherCodeMeta(weatherCode).label,
      tempMax: max[index] ?? 0,
      tempMin: min[index] ?? 0,
    }
  })
}
