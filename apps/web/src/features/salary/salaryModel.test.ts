import { describe, expect, it } from 'vitest'
import {
  dailyPay,
  dayStatus,
  earnedBetween,
  nextWorkStart,
  paidSegments,
  priceInWorkTime,
  ratePerSecond,
  workdaysInMonth,
  type SalarySettings,
} from './salaryModel'
import { normalizeSalarySettings, normalizeSalaryState, BREAK_RETENTION_MS } from './salaryStorage'
import { formatWorkDuration, parseClock } from './salaryFormat'

const settings: SalarySettings = {
  monthlySalary: 12000,
  workStart: 9 * 60,
  workEnd: 18 * 60,
  lunch: { start: 12 * 60, end: 13 * 60 },
  workdays: [1, 2, 3, 4, 5],
}

// July 2026 has 23 weekdays, so a day pays 12000 / 23 = ¥521.74.
const at = (day: number, hours: number, minutes = 0) => new Date(2026, 6, day, hours, minutes).getTime()

const t = (key: string, values?: Record<string, string | number>) =>
  key === 'salary.duration.hm' ? `${values?.h}h${values?.m}m` : key === 'salary.duration.h' ? `${values?.h}h` : key === 'salary.duration.m' ? `${values?.m}m` : '<1m'

describe('salary model', () => {
  it('spreads the month over its working days and the day over its paid seconds', () => {
    expect(workdaysInMonth(settings, at(15, 10))).toBe(23)
    expect(dailyPay(settings, at(15, 10))).toBeCloseTo(521.74, 2)
    expect(ratePerSecond(settings, at(15, 10))).toBeCloseTo(0.01812, 5)
  })

  it('counts today’s pay up to now, pausing over lunch', () => {
    const afternoon = dayStatus(settings, at(15, 14, 20))
    expect(afternoon.phase).toBe('working')
    expect(afternoon.earned).toBeCloseTo(282.61, 2)
    expect(Math.round(afternoon.progress * 100)).toBe(54)
    expect(afternoon.expected).toBeCloseTo(521.74, 2)

    const lunch = dayStatus(settings, at(15, 12, 30))
    expect(lunch.phase).toBe('lunch')
    expect(lunch.paidMs).toBe(3 * 3600_000)

    expect(dayStatus(settings, at(15, 8)).phase).toBe('before')
    expect(dayStatus(settings, at(15, 8)).earned).toBe(0)
    const evening = dayStatus(settings, at(15, 20))
    expect(evening.phase).toBe('after')
    expect(evening.earned).toBeCloseTo(521.74, 2)
  })

  it('treats a day off as off, and finds the next start', () => {
    const saturday = at(18, 11)
    expect(dayStatus(settings, saturday).phase).toBe('off')
    expect(dayStatus(settings, saturday).expected).toBe(0)
    expect(nextWorkStart(settings, saturday)).toBe(at(20, 9))
  })

  it('turns a price into work time', () => {
    const cost = priceInWorkTime(settings, 1399, at(15, 10))
    expect(cost).not.toBeNull()
    expect(formatWorkDuration(cost!.seconds, t)).toBe('21h27m')
    expect(cost!.days).toBeCloseTo(2.68, 2)
    expect(priceInWorkTime(settings, 0, at(15, 10))).toBeNull()
  })

  it('pays a break only for its paid minutes', () => {
    expect(earnedBetween(settings, at(15, 14, 2), at(15, 14, 39))).toBeCloseTo(40.22, 2)
    // 11:50–12:20 crosses into lunch: only ten minutes are paid.
    expect(earnedBetween(settings, at(15, 11, 50), at(15, 12, 20))).toBeCloseTo(600 * ratePerSecond(settings, at(15, 10)), 6)
  })

  it('uses each month’s own rate across a month boundary', () => {
    const from = new Date(2026, 5, 30, 9).getTime() // Tue 30 June
    const to = at(1, 18) // Wed 1 July
    const expected = dailyPay(settings, from) + dailyPay(settings, to)
    expect(earnedBetween(settings, from, to)).toBeCloseTo(expected, 6)
  })

  it('splits a working day around lunch, or not at all without one', () => {
    expect(paidSegments(settings, at(15, 0))).toEqual([
      [at(15, 9), at(15, 12)],
      [at(15, 13), at(15, 18)],
    ])
    expect(paidSegments({ ...settings, lunch: null }, at(15, 0))).toEqual([[at(15, 9), at(15, 18)]])
    expect(paidSegments(settings, at(18, 0))).toEqual([])
  })
})

describe('salary storage', () => {
  it('rejects settings that cannot be worked', () => {
    expect(normalizeSalarySettings({ ...settings, monthlySalary: 0 })).toBeNull()
    expect(normalizeSalarySettings({ ...settings, workEnd: 8 * 60 })).toBeNull()
    expect(normalizeSalarySettings({ ...settings, workdays: [] })).toBeNull()
    expect(normalizeSalarySettings({ ...settings, lunch: { start: 13 * 60, end: 12 * 60 } })?.lunch).toBeNull()
    expect(normalizeSalarySettings({ ...settings, workdays: [5, 1, 1, 9] })?.workdays).toEqual([1, 5])
  })

  it('keeps about two months of breaks and drops malformed rows', () => {
    const now = at(15, 12)
    const state = normalizeSalaryState(
      {
        settings,
        wishlist: [{ id: 'w', name: 'Headphones', price: 1399, addedAt: now }, { id: 'bad', price: -1 }],
        breaks: [
          { id: 'old', startAt: now - BREAK_RETENTION_MS - 10_000, endAt: now - BREAK_RETENTION_MS - 5_000 },
          { id: 'recent', startAt: now - 60_000, endAt: now - 30_000 },
          { id: 'reversed', startAt: now, endAt: now - 1 },
        ],
        activeBreakStartAt: 'soon',
      },
      now,
    )
    expect(state.wishlist.map((item) => item.id)).toEqual(['w'])
    expect(state.breaks.map((item) => item.id)).toEqual(['recent'])
    expect(state.activeBreakStartAt).toBeNull()
  })

  it('parses clock strings', () => {
    expect(parseClock('09:30')).toBe(570)
    expect(parseClock('24:00')).toBe(1440)
    expect(parseClock('25:00')).toBeNull()
    expect(parseClock('9')).toBeNull()
  })
})
