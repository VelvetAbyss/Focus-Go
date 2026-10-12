import { useEffect, useMemo, useState } from 'react'
import { fetchIcsEventsWithFallback } from '../calendar/calendar.ics'
import type { SalarySettings } from './salaryModel'

/**
 * China's statutory holidays and makeup workdays (调休), for the pay widgets. Two public feeds
 * the API already proxies for signed-out users: one lists the days off, the other the weekend
 * days worked to make up for them. Kept in this browser for a week.
 */
const OFF_FEED = 'https://ical.muhan.org/rest.ics'
const WORK_FEED = 'https://ical.muhan.org/work.ics'
const CACHE_KEY = 'focusgo.salary.cnHolidays.v1'
const FRESH_MS = 7 * 24 * 60 * 60 * 1000

export type HolidayOverrides = Record<string, 'off' | 'work'>

type Cached = { fetchedAt: number; overrides: HolidayOverrides }

const readCache = (): Cached | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null
    return parsed && typeof parsed.fetchedAt === 'number' && parsed.overrides && typeof parsed.overrides === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** Day-off and makeup-day events as overrides; a date in both feeds is a workday. */
export const buildOverrides = (offDates: readonly string[], workDates: readonly string[]): HolidayOverrides => {
  const overrides: HolidayOverrides = {}
  for (const date of offDates) overrides[date] = 'off'
  for (const date of workDates) overrides[date] = 'work'
  return overrides
}

let inflight: Promise<HolidayOverrides | null> | null = null

/** The overrides, from the cache when fresh, else from the feeds; the stale cache if they fail. */
export const loadCnHolidayOverrides = (now = Date.now()): Promise<HolidayOverrides | null> => {
  const cached = readCache()
  if (cached && now - cached.fetchedAt < FRESH_MS) return Promise.resolve(cached.overrides)
  inflight ??= Promise.all([
    fetchIcsEventsWithFallback(OFF_FEED, 'salary-cn-off'),
    fetchIcsEventsWithFallback(WORK_FEED, 'salary-cn-work'),
  ])
    .then(([off, work]) => {
      const overrides = buildOverrides(off.map((event) => event.dateKey), work.map((event) => event.dateKey))
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: now, overrides } satisfies Cached))
      } catch {
        // storage full: used for this session only
      }
      return overrides
    })
    .catch(() => cached?.overrides ?? null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * The saved pay settings with holidays applied: what the pay widgets compute with. Without the
 * holiday data yet (first load, offline) the weekdays alone are used.
 */
export const useWorkingSalarySettings = (settings: SalarySettings | null): SalarySettings | null => {
  const follow = Boolean(settings) && settings?.followCnHolidays !== false
  const [overrides, setOverrides] = useState<HolidayOverrides | null>(() => (follow ? readCache()?.overrides ?? null : null))
  useEffect(() => {
    if (!follow) return
    let cancelled = false
    void loadCnHolidayOverrides().then((next) => {
      if (!cancelled && next) setOverrides(next)
    })
    return () => {
      cancelled = true
    }
  }, [follow])
  return useMemo(() => {
    if (!settings) return null
    return follow && overrides ? { ...settings, overrides } : settings
  }, [follow, overrides, settings])
}
