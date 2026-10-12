import { describe, expect, it } from 'vitest'
import type { WorldClockItem } from '../../shared/prefs/preferences'
import { pickSecondZone, secondZoneLabel } from './secondZone'

const city = (label: string, timeZone: string, alias?: string): WorldClockItem => ({
  id: label, label, searchValue: label, latitude: 0, longitude: 0, timeZone, alias,
})

describe('second time zone', () => {
  it('picks the first city outside your own zone', () => {
    const items = [city('Shanghai, China', 'Asia/Shanghai'), city('New York, United States', 'America/New_York')]
    expect(pickSecondZone(items, 'Asia/Shanghai')?.label).toBe('New York, United States')
    expect(pickSecondZone([items[0]], 'Asia/Shanghai')).toBeNull()
  })

  it("reads an event's start in the other city, with its weekday when the date differs", () => {
    // Tuesday 2026-10-13 10:00 in Shanghai = Monday 22:00 in New York.
    const startAt = Date.UTC(2026, 9, 13, 2, 0)
    expect(secondZoneLabel(startAt, city('New York, United States', 'America/New_York'), 'Asia/Shanghai', 'zh-CN')).toBe('New York 周一 22:00')
    // Same date: no weekday; your own name for the row wins.
    const sameDay = Date.UTC(2026, 9, 13, 14, 0)
    expect(secondZoneLabel(sameDay, city('New York, United States', 'America/New_York', "Lowe's"), 'Asia/Shanghai', 'zh-CN')).toBe("Lowe's 10:00")
  })
})
