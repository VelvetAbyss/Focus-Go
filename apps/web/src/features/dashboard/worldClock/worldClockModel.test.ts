import { describe, expect, it } from 'vitest'
import { holidayFor, isUsTimeZone, usFederalHolidays } from './usHolidays'
import { clockOf, minutesOf, workStateAt } from './workHours'

describe('usFederalHolidays', () => {
  it('works out the 2026 dates, with weekend holidays observed on a weekday', () => {
    const byName = Object.fromEntries(usFederalHolidays(2026).map((holiday) => [holiday.en, holiday.dateKey]))
    expect(byName['Columbus Day']).toBe('2026-10-12')
    expect(byName.Thanksgiving).toBe('2026-11-26')
    expect(byName['Memorial Day']).toBe('2026-05-25')
    expect(byName['Labor Day']).toBe('2026-09-07')
    // July 4th 2026 is a Saturday → Friday the 3rd.
    expect(byName['Independence Day']).toBe('2026-07-03')
    expect(byName['Veterans Day']).toBe('2026-11-11')
  })

  it('observes a Sunday holiday on the Monday', () => {
    // Christmas 2022 fell on a Sunday.
    expect(usFederalHolidays(2022).find((holiday) => holiday.en === 'Christmas Day')?.dateKey).toBe('2022-12-26')
  })
})

describe('holidayFor', () => {
  it('knows US zones only', () => {
    expect(isUsTimeZone('America/New_York')).toBe(true)
    expect(isUsTimeZone('America/Indiana/Indianapolis')).toBe(true)
    expect(isUsTimeZone('America/Vancouver')).toBe(false)
    expect(holidayFor('America/Los_Angeles', '2026-10-12')?.zh).toBe('哥伦布日')
    expect(holidayFor('America/Vancouver', '2026-10-12')).toBeNull()
    expect(holidayFor('America/New_York', '2026-10-13')).toBeNull()
  })
})

describe('workStateAt', () => {
  it('reads the working day', () => {
    expect(workStateAt(8 * 60, 1)).toEqual({ kind: 'before', startsAt: 540 })
    expect(workStateAt(10 * 60, 2)).toEqual({ kind: 'working', minutesLeft: 480 })
    expect(workStateAt(17 * 60 + 20, 3)).toEqual({ kind: 'closing', minutesLeft: 40 })
    expect(workStateAt(18 * 60, 4)).toEqual({ kind: 'after' })
    expect(workStateAt(11 * 60, 6)).toEqual({ kind: 'weekend' })
  })

  it('follows custom hours and lets a holiday win', () => {
    expect(workStateAt(8 * 60, 1, { start: 7 * 60 + 30, end: 16 * 60 })).toEqual({ kind: 'working', minutesLeft: 480 })
    expect(workStateAt(10 * 60, 1, {}, '哥伦布日')).toEqual({ kind: 'holiday', name: '哥伦布日' })
  })

  it('converts clock strings', () => {
    expect(clockOf(510)).toBe('08:30')
    expect(minutesOf('8:30')).toBe(510)
    expect(minutesOf('24:00')).toBeNull()
    expect(minutesOf('noon')).toBeNull()
  })
})
