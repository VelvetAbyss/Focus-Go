/**
 * Lightweight weather service backed by open-meteo.com (no API key).
 *
 * Two-tier fallback:
 *   1. Forecast endpoint covers ~16 days into the future.
 *   2. For dates further out we fall back to "climate normals" — the historical
 *      monthly average for that location. Less precise, but still useful for
 *      "should I pack a coat?" decisions on a trip 3 months away.
 *
 * All responses are cached in-memory for 6h so repeat renders don't hammer the
 * API. We never throw — callers get null on any failure and decide whether to
 * render a placeholder or hide the affected UI.
 */

export type WeatherDay = {
  date: string // YYYY-MM-DD
  tempHigh: number
  tempLow: number
  icon: string // emoji
  source: 'forecast' | 'climate'
  precipitationMm?: number
  weatherCode?: number
}

const SIX_HOURS = 6 * 60 * 60 * 1000

type CacheEntry<T> = { data: T; expiresAt: number }

const cache = new Map<string, CacheEntry<WeatherDay[] | null>>()

const cacheKey = (lat: number, lng: number, start: string, end: string) =>
  `${lat.toFixed(3)},${lng.toFixed(3)}|${start}|${end}`

/**
 * WMO weather code → emoji map. Covers the common buckets; rare codes fall
 * through to a neutral cloud icon.
 */
const codeToEmoji = (code: number | undefined): string => {
  if (code == null) return '🌤'
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤'
  if (code === 3) return '☁️'
  if (code === 45 || code === 48) return '🌫'
  if (code >= 51 && code <= 57) return '🌦'
  if (code >= 61 && code <= 67) return '🌧'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌧'
  if (code >= 85 && code <= 86) return '🌨'
  if (code >= 95) return '⛈'
  return '🌤'
}

const today = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const daysBetween = (a: string, b: string): number => {
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((db - da) / (24 * 60 * 60 * 1000))
}

type ForecastResponse = {
  daily?: {
    time?: string[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    weather_code?: number[]
    precipitation_sum?: number[]
  }
}

const fetchForecast = async (lat: number, lng: number, start: string, end: string): Promise<WeatherDay[]> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum` +
    `&start_date=${start}&end_date=${end}&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`forecast ${res.status}`)
  const data = (await res.json()) as ForecastResponse
  const dates = data.daily?.time ?? []
  const highs = data.daily?.temperature_2m_max ?? []
  const lows = data.daily?.temperature_2m_min ?? []
  const codes = data.daily?.weather_code ?? []
  const precip = data.daily?.precipitation_sum ?? []
  return dates.map((date, i) => ({
    date,
    tempHigh: Math.round(highs[i] ?? 0),
    tempLow: Math.round(lows[i] ?? 0),
    icon: codeToEmoji(codes[i]),
    weatherCode: codes[i],
    precipitationMm: precip[i],
    source: 'forecast' as const,
  }))
}

type ClimateResponse = {
  daily?: {
    time?: string[]
    temperature_2m_max_mean?: number[]
    temperature_2m_min_mean?: number[]
  }
}

/**
 * Pull monthly climate normals via the historical climate API. We request a
 * single representative year (this year) and pick out the days that match the
 * requested range's month-day, since climate normals are essentially per-day-
 * of-year averages.
 */
const fetchClimateNormals = async (lat: number, lng: number, start: string, end: string): Promise<WeatherDay[]> => {
  const referenceYear = new Date().getFullYear()
  const refStart = `${referenceYear}-${start.slice(5)}`
  const refEnd = `${referenceYear}-${end.slice(5)}`
  const url = `https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lng}` +
    `&start_date=${refStart}&end_date=${refEnd}&models=MRI_AGCM3_2_S` +
    `&daily=temperature_2m_max_mean,temperature_2m_min_mean`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`climate ${res.status}`)
  const data = (await res.json()) as ClimateResponse
  const dates = data.daily?.time ?? []
  const highs = data.daily?.temperature_2m_max_mean ?? []
  const lows = data.daily?.temperature_2m_min_mean ?? []
  return dates.map((d, i) => ({
    // Translate the reference-year date back to the requested year so callers
    // get the same date key they passed in.
    date: `${start.slice(0, 4)}${d.slice(4)}`,
    tempHigh: Math.round(highs[i] ?? 0),
    tempLow: Math.round(lows[i] ?? 0),
    icon: '🌤',
    source: 'climate' as const,
  }))
}

export const getForecast = async (
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<WeatherDay[] | null> => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !startDate || !endDate) return null
  const key = cacheKey(lat, lng, startDate, endDate)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data

  const daysAhead = daysBetween(today(), startDate)
  const useForecast = daysAhead <= 14 // open-meteo covers ~16d; give a small safety margin
  try {
    const data = useForecast
      ? await fetchForecast(lat, lng, startDate, endDate)
      : await fetchClimateNormals(lat, lng, startDate, endDate)
    cache.set(key, { data, expiresAt: Date.now() + SIX_HOURS })
    return data
  } catch {
    // If forecast fails (e.g. dates partially in past), fall back to climate.
    if (useForecast) {
      try {
        const climate = await fetchClimateNormals(lat, lng, startDate, endDate)
        cache.set(key, { data: climate, expiresAt: Date.now() + SIX_HOURS })
        return climate
      } catch {
        cache.set(key, { data: null, expiresAt: Date.now() + 5 * 60 * 1000 }) // 5m negative cache
        return null
      }
    }
    cache.set(key, { data: null, expiresAt: Date.now() + 5 * 60 * 1000 })
    return null
  }
}
