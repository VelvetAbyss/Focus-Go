/**
 * US federal holidays, worked out by rule for any year (no network): the days a US buyer's office,
 * bank or government is likely shut. Saturday holidays are observed on the Friday before, Sunday
 * ones on the Monday after.
 */

export type Holiday = { dateKey: string; zh: string; en: string }

const pad = (value: number) => String(value).padStart(2, '0')
const key = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`

/** The nth weekday (0 = Sunday) of a month; n = -1 for the last one. */
const nthWeekday = (year: number, month: number, weekday: number, n: number) => {
  if (n > 0) {
    const first = new Date(year, month - 1, 1).getDay()
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7
  }
  const lastDay = new Date(year, month, 0).getDate()
  const last = new Date(year, month - 1, lastDay).getDay()
  return lastDay - ((last - weekday + 7) % 7)
}

const observed = (year: number, month: number, day: number) => {
  const date = new Date(year, month - 1, day)
  if (date.getDay() === 6) date.setDate(date.getDate() - 1)
  else if (date.getDay() === 0) date.setDate(date.getDate() + 1)
  return key(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

export const usFederalHolidays = (year: number): Holiday[] => [
  { dateKey: observed(year, 1, 1), zh: '元旦', en: "New Year's Day" },
  { dateKey: key(year, 1, nthWeekday(year, 1, 1, 3)), zh: '马丁·路德·金纪念日', en: 'Martin Luther King Jr. Day' },
  { dateKey: key(year, 2, nthWeekday(year, 2, 1, 3)), zh: '总统日', en: "Presidents' Day" },
  { dateKey: key(year, 5, nthWeekday(year, 5, 1, -1)), zh: '阵亡将士纪念日', en: 'Memorial Day' },
  { dateKey: observed(year, 6, 19), zh: '六月节', en: 'Juneteenth' },
  { dateKey: observed(year, 7, 4), zh: '独立日', en: 'Independence Day' },
  { dateKey: key(year, 9, nthWeekday(year, 9, 1, 1)), zh: '劳动节', en: 'Labor Day' },
  { dateKey: key(year, 10, nthWeekday(year, 10, 1, 2)), zh: '哥伦布日', en: 'Columbus Day' },
  { dateKey: observed(year, 11, 11), zh: '退伍军人节', en: 'Veterans Day' },
  { dateKey: key(year, 11, nthWeekday(year, 11, 4, 4)), zh: '感恩节', en: 'Thanksgiving' },
  { dateKey: observed(year, 12, 25), zh: '圣诞节', en: 'Christmas Day' },
]

// IANA zones in the United States (the ones a city search can return).
const US_ZONES = new Set([
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'America/Adak', 'America/Boise', 'America/Detroit', 'America/Juneau',
  'America/Menominee', 'America/Metlakatla', 'America/Nome', 'America/Sitka', 'America/Yakutat',
  'Pacific/Honolulu',
])

export const isUsTimeZone = (timeZone: string) =>
  US_ZONES.has(timeZone) || /^America\/(Indiana|Kentucky|North_Dakota)\//.test(timeZone)

const cache = new Map<number, Holiday[]>()

/** The holiday a city keeps on its local date, if any (US cities only, for now). */
export const holidayFor = (timeZone: string, localDateKey: string): Holiday | null => {
  if (!isUsTimeZone(timeZone)) return null
  const year = Number(localDateKey.slice(0, 4))
  if (!cache.has(year)) cache.set(year, usFederalHolidays(year))
  return cache.get(year)!.find((holiday) => holiday.dateKey === localDateKey) ?? null
}
