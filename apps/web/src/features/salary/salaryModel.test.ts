import { describe, expect, it } from 'vitest'
import {
  dailyPay,
  dayStatus,
  daysUntilDayOff,
  daysUntilPayday,
  isWorkday,
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

  it('keeps the pay currency, and leaves it unset to follow the app default', () => {
    expect(normalizeSalarySettings({ ...settings, currency: 'CNY' })?.currency).toBe('CNY')
    expect(normalizeSalarySettings({ ...settings, currency: 'USD' })?.currency).toBe('USD')
    expect(normalizeSalarySettings({ ...settings, currency: 'EUR' })).not.toHaveProperty('currency')
    expect(normalizeSalarySettings(settings)).not.toHaveProperty('currency')
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

describe('holidays, makeup days and countdowns', () => {
  const base: SalarySettings = { monthlySalary: 12000, workStart: 540, workEnd: 1080, lunch: { start: 720, end: 780 }, workdays: [1, 2, 3, 4, 5] }

  it('pays no holiday and does pay a makeup Saturday', () => {
    const withHolidays: SalarySettings = { ...base, overrides: { '2026-10-01': 'off', '2026-10-10': 'work' } }
    // Thursday 1 October, National Day: off.
    expect(isWorkday(withHolidays, new Date(2026, 9, 1, 10).getTime())).toBe(false)
    // Saturday 10 October, a 调休 workday: paid.
    expect(isWorkday(withHolidays, new Date(2026, 9, 10, 10).getTime())).toBe(true)
    expect(dayStatus(withHolidays, new Date(2026, 9, 10, 10).getTime()).phase).toBe('working')
  })

  it('spreads the month over its real working days', () => {
    const october = new Date(2026, 9, 15).getTime()
    expect(workdaysInMonth(base, october)).toBe(22)
    // Seven holidays fall on five weekdays (1, 2, 5, 6, 7 Oct), and 10 Oct is worked: 22 − 5 + 1.
    const overrides = { '2026-10-01': 'off', '2026-10-02': 'off', '2026-10-03': 'off', '2026-10-04': 'off', '2026-10-05': 'off', '2026-10-06': 'off', '2026-10-07': 'off', '2026-10-10': 'work' } as const
    expect(workdaysInMonth({ ...base, overrides }, october)).toBe(18)
  })

  it('counts down to the next day off and to payday', () => {
    // Wednesday 14 October 2026.
    const wednesday = new Date(2026, 9, 14, 15).getTime()
    expect(daysUntilDayOff(base, wednesday)).toBe(3)
    expect(daysUntilDayOff(base, new Date(2026, 9, 17, 10).getTime())).toBe(0)
    expect(daysUntilPayday(base, wednesday)).toBeNull()
    expect(daysUntilPayday({ ...base, payday: 20 }, wednesday)).toBe(6)
    expect(daysUntilPayday({ ...base, payday: 14 }, wednesday)).toBe(0)
    // Past this month's payday: next month's; the 31st in a 30-day month is its last day.
    expect(daysUntilPayday({ ...base, payday: 10 }, wednesday)).toBe(27)
    expect(daysUntilPayday({ ...base, payday: 31 }, new Date(2026, 10, 2).getTime())).toBe(28)
  })
})

describe('normalizeSalarySettings keeps payday and the holiday switch', () => {
  it('keeps a valid payday, drops a bad one, and stores the switch only when off', () => {
    const raw = { monthlySalary: 1, workStart: 540, workEnd: 1080, lunch: null, workdays: [1] }
    expect(normalizeSalarySettings({ ...raw, payday: 10, followCnHolidays: true })).toEqual({ ...raw, payday: 10 })
    expect(normalizeSalarySettings({ ...raw, payday: 40, followCnHolidays: false })).toEqual({ ...raw, followCnHolidays: false })
    // Runtime overrides never get saved.
    expect(normalizeSalarySettings({ ...raw, overrides: { '2026-10-01': 'off' } })).toEqual(raw)
  })
})
