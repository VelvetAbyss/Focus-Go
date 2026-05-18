import { searchCityLocation } from '../weather/weatherApi'
import type { CitySuggestion } from '../../shared/location/citySuggestions'
import type { LanguageCode } from '../../shared/i18n/types'
import type { WorldClockItem } from '../../shared/prefs/preferences'

type OpenMeteoTimezoneResponse = {
  timezone?: string
}

export type WorldClockDisplay = {
  date: string
  time: string
  weekday: string
  location: string
}

async function fetchTimeZone(latitude: number, longitude: number): Promise<string> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&forecast_days=1&timezone=auto`
  )
  if (!response.ok) throw new Error(`Timezone request failed: ${response.status}`)
  const payload = (await response.json()) as OpenMeteoTimezoneResponse
  if (!payload.timezone) throw new Error('Timezone missing')
  return payload.timezone
}

const UTC_TIMEZONE_RE = /^(gmt|utc|etc\/gmt|etc\/utc)$/i
const formatterCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (locale: string, timeZone: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale}:${timeZone}:${JSON.stringify(options)}`
  const cached = formatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone })
  formatterCache.set(key, formatter)
  return formatter
}

function shouldRepairTimeZone(item: WorldClockItem) {
  return UTC_TIMEZONE_RE.test(item.timeZone) && Math.abs(item.longitude) >= 30
}

export async function resolveWorldClockItemFromSuggestion(suggestion: CitySuggestion): Promise<WorldClockItem> {
  const location = await searchCityLocation(suggestion.searchValue)
  if (!location) throw new Error('Location not found')

  const timeZone = await fetchTimeZone(location.latitude, location.longitude)
  return {
    id: `${location.name}:${timeZone}`,
    label: location.name,
    searchValue: suggestion.searchValue,
    latitude: location.latitude,
    longitude: location.longitude,
    timeZone,
  }
}

export async function repairWorldClockItems(items: WorldClockItem[]): Promise<WorldClockItem[]> {
  const repaired = await Promise.all(
    items.map(async (item) => {
      if (!shouldRepairTimeZone(item)) return item
      try {
        const timeZone = await fetchTimeZone(item.latitude, item.longitude)
        return timeZone === item.timeZone ? item : { ...item, id: `${item.label}:${timeZone}`, timeZone }
      } catch {
        return item
      }
    })
  )

  return repaired
}

export function formatWorldClockDisplay(item: WorldClockItem, language: LanguageCode, now: Date): WorldClockDisplay {
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const dateParts = getFormatter(locale, item.timeZone, {
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const month = dateParts.find((part) => part.type === 'month')?.value ?? '00'
  const day = dateParts.find((part) => part.type === 'day')?.value ?? '00'

  return {
    date: `${month}/${day}`,
    time: getFormatter(locale, item.timeZone, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now),
    weekday: getFormatter(locale, item.timeZone, {
      weekday: 'short',
    }).format(now),
    location: item.label,
  }
}
