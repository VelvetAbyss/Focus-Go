/**
 * Working-time maths for the dashboard's pay widgets: what a second of your
 * working day is paid, how much of today is already paid, and what a price
 * costs in working time. Pure; every time is local wall-clock.
 *
 * Pay model: a month's salary is spread evenly over that month's working days
 * (the weekdays you work), and a day's pay evenly over its paid minutes (work
 * hours minus lunch). With ¥12,000, 23 working days and 9:00–18:00 with an
 * hour's lunch, a day pays ¥521.74 and a second ¥0.01812.
 */

export type SalaryLunch = {
  /** Minutes after midnight. */
  start: number
  end: number
}

export type SalarySettings = {
  /** Monthly pay, in the user's default currency. */
  monthlySalary: number
  /** Minutes after midnight. */
  workStart: number
  workEnd: number
  /** Unpaid lunch break; null for none. */
  lunch: SalaryLunch | null
  /** Days of the week worked, 0 = Sunday (as `Date#getDay`). */
  workdays: number[]
}

export const DEFAULT_WORK_HOURS: Omit<SalarySettings, 'monthlySalary'> = {
  workStart: 9 * 60,
  workEnd: 18 * 60,
  lunch: { start: 12 * 60, end: 13 * 60 },
  workdays: [1, 2, 3, 4, 5],
}

/** Ten years: the furthest back a wish or break is counted. */
const MAX_DAYS = 3660

export const startOfLocalDay = (time: number) => {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const nextLocalDay = (dayStart: number) => {
  const date = new Date(dayStart)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
}

/** The instant `minutes` after midnight on the day starting at `dayStart`. */
export const atMinutes = (dayStart: number, minutes: number) => {
  const date = new Date(dayStart)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes).getTime()
}

/** Monday 00:00 of the week containing `time`. */
export const startOfLocalWeek = (time: number) => {
  const date = new Date(time)
  const mondayOffset = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset).getTime()
}

export const isWorkday = (settings: SalarySettings, time: number) => settings.workdays.includes(new Date(time).getDay())

const lunchOverlap = (settings: SalarySettings) => {
  const { lunch, workStart, workEnd } = settings
  if (!lunch) return 0
  return Math.max(0, Math.min(lunch.end, workEnd) - Math.max(lunch.start, workStart))
}

export const paidMinutesPerDay = (settings: SalarySettings) =>
  Math.max(0, settings.workEnd - settings.workStart - lunchOverlap(settings))

/** The paid stretches of one day as [from, to) instants; none on a day off. */
export const paidSegments = (settings: SalarySettings, dayStart: number): Array<[number, number]> => {
  if (!isWorkday(settings, dayStart)) return []
  const { workStart, workEnd, lunch } = settings
  const minutes: Array<[number, number]> =
    lunch && lunchOverlap(settings) > 0
      ? [
          [workStart, Math.max(workStart, lunch.start)],
          [Math.min(workEnd, lunch.end), workEnd],
        ]
      : [[workStart, workEnd]]
  return minutes.filter(([from, to]) => to > from).map(([from, to]) => [atMinutes(dayStart, from), atMinutes(dayStart, to)])
}

export const workdaysInMonth = (settings: SalarySettings, time: number) => {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = date.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let day = 1; day <= days; day += 1) {
    if (settings.workdays.includes(new Date(year, month, day).getDay())) count += 1
  }
  return count
}

/** One working day's pay in the month containing `time`. */
export const dailyPay = (settings: SalarySettings, time: number) => {
  const days = workdaysInMonth(settings, time)
  return days > 0 ? settings.monthlySalary / days : 0
}

/** Pay per paid second in the month containing `time`. */
export const ratePerSecond = (settings: SalarySettings, time: number) => {
  const minutes = paidMinutesPerDay(settings)
  return minutes > 0 ? dailyPay(settings, time) / (minutes * 60) : 0
}

const forEachPaidOverlap = (
  settings: SalarySettings,
  from: number,
  to: number,
  visit: (ms: number, dayStart: number) => void,
) => {
  if (!(to > from)) return
  let day = startOfLocalDay(from)
  for (let index = 0; index < MAX_DAYS && day < to; index += 1) {
    for (const [segmentFrom, segmentTo] of paidSegments(settings, day)) {
      const ms = Math.min(segmentTo, to) - Math.max(segmentFrom, from)
      if (ms > 0) visit(ms, day)
    }
    day = nextLocalDay(day)
  }
}

/** Paid milliseconds between two instants. */
export const paidMsBetween = (settings: SalarySettings, from: number, to: number) => {
  let total = 0
  forEachPaidOverlap(settings, from, to, (ms) => {
    total += ms
  })
  return total
}

/** Pay accrued between two instants, at each month's own rate. */
export const earnedBetween = (settings: SalarySettings, from: number, to: number) => {
  const rates = new Map<string, number>()
  let total = 0
  forEachPaidOverlap(settings, from, to, (ms, dayStart) => {
    const date = new Date(dayStart)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    let rate = rates.get(key)
    if (rate === undefined) {
      rate = ratePerSecond(settings, dayStart)
      rates.set(key, rate)
    }
    total += (ms / 1000) * rate
  })
  return total
}

export type DayPhase = 'off' | 'before' | 'working' | 'lunch' | 'after'

export type DayStatus = {
  phase: DayPhase
  /** Today's paid stretches. */
  segments: Array<[number, number]>
  /** Work start and end today. */
  start: number
  end: number
  /** Pay so far today. */
  earned: number
  /** The whole day's pay; 0 on a day off. */
  expected: number
  /** Pay per paid second this month. */
  rate: number
  paidMs: number
  totalPaidMs: number
  /** Share of today's paid time already worked, 0–1. */
  progress: number
}

export const dayStatus = (settings: SalarySettings, now: number): DayStatus => {
  const dayStart = startOfLocalDay(now)
  const segments = paidSegments(settings, dayStart)
  const start = atMinutes(dayStart, settings.workStart)
  const end = atMinutes(dayStart, settings.workEnd)
  const rate = ratePerSecond(settings, now)
  const totalPaidMs = segments.reduce((sum, [from, to]) => sum + (to - from), 0)
  const paidMs = paidMsBetween(settings, dayStart, now)
  const lunch = settings.lunch
  const inLunch = Boolean(lunch) && now >= atMinutes(dayStart, lunch!.start) && now < atMinutes(dayStart, lunch!.end)
  const phase: DayPhase =
    segments.length === 0 ? 'off' : now < start ? 'before' : now >= end ? 'after' : inLunch ? 'lunch' : 'working'
  return {
    phase,
    segments,
    start,
    end,
    earned: (paidMs / 1000) * rate,
    expected: segments.length > 0 ? dailyPay(settings, now) : 0,
    rate,
    paidMs,
    totalPaidMs,
    progress: totalPaidMs > 0 ? Math.min(1, paidMs / totalPaidMs) : 0,
  }
}

/** When the next working day starts, looking up to a week ahead; null if none. */
export const nextWorkStart = (settings: SalarySettings, now: number) => {
  let day = startOfLocalDay(now)
  for (let index = 0; index < 8; index += 1) {
    const start = atMinutes(day, settings.workStart)
    if (isWorkday(settings, day) && start > now) return start
    day = nextLocalDay(day)
  }
  return null
}

/** What `price` costs in paid time this month: seconds, and working days. */
export const priceInWorkTime = (settings: SalarySettings, price: number, now: number) => {
  const rate = ratePerSecond(settings, now)
  const perDay = dailyPay(settings, now)
  if (!(price > 0) || rate <= 0 || perDay <= 0) return null
  return { seconds: price / rate, days: price / perDay }
}
