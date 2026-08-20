import { describe, expect, it } from 'vitest'
import { formatWorldClockDisplay, repairWorldClockItems } from './worldClock'
import { afterEach, vi } from 'vitest'
import type { WorldClockItem } from '../../shared/prefs/preferences'

const shanghai: WorldClockItem = {
  id: 'shanghai',
  label: 'Shanghai, China',
  searchValue: 'Shanghai',
  latitude: 31.23,
  longitude: 121.47,
  timeZone: 'Asia/Shanghai',
}

const newYork: WorldClockItem = {
  id: 'new-york',
  label: 'New York, United States',
  searchValue: 'New York',
  latitude: 40.71,
  longitude: -74.0,
  timeZone: 'America/New_York',
}

describe('formatWorldClockDisplay', () => {
  it('formats date and time in the target timezone', () => {
    const now = new Date('2026-04-13T16:30:00.000Z')
    const display = formatWorldClockDisplay(shanghai, 'zh', now)

    expect(display.date).toBe('04/14')
    expect(display.time).toBe('00:30')
    expect(display.weekday).toBe('周二')
  })

  it('uses the supplied location label', () => {
    const now = new Date('2026-04-13T16:30:00.000Z')
    const display = formatWorldClockDisplay(newYork, 'en', now)

    expect(display.location).toBe('New York, United States')
    expect(display.time).toMatch(/^\d{2}:\d{2}$/)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('repairWorldClockItems', () => {
  it('repairs bad utc-like persisted timezones for remote cities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ timezone: 'America/New_York' }),
      }))
    )

    const repaired = await repairWorldClockItems([{ ...newYork, timeZone: 'GMT' }])

    expect(repaired[0]?.timeZone).toBe('America/New_York')
  })
})
