import { sunEclipticLongitude } from '../worldClock/solar'

/**
 * The Chinese calendar facts the dashboard shows under the date: the lunar
 * day, a traditional festival, and the solar term that falls on the day.
 */

const LUNAR_DAY_LABELS = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
]

// Indexed by the sun's ecliptic longitude / 15°, starting at the March equinox.
const SOLAR_TERMS = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
]

// Keyed by lunar month and day. A leap month ("闰五月") never matches.
const LUNAR_FESTIVALS: Record<string, string> = {
  '正月/1': '春节',
  '正月/15': '元宵节',
  '五月/5': '端午节',
  '七月/7': '七夕',
  '八月/15': '中秋节',
  '九月/9': '重阳节',
  '腊月/8': '腊八节',
}

const lunarFormat = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { month: 'long', day: 'numeric' })

const lunarParts = (date: Date) => {
  const parts = lunarFormat.formatToParts(date)
  return {
    month: parts.find((part) => part.type === 'month')?.value ?? '',
    day: Number.parseInt(parts.find((part) => part.type === 'day')?.value ?? '', 10),
  }
}

/** The lunar month ("八月", "闰六月") and day ("十八") of a local date. */
export const lunarDay = (date: Date) => {
  const { month, day } = lunarParts(date)
  const dayLabel = Number.isNaN(day) || day <= 0 || day >= LUNAR_DAY_LABELS.length ? String(day) : LUNAR_DAY_LABELS[day]
  return { month, day, dayLabel }
}

/** "八月十八" */
export const lunarDateLabel = (date: Date) => {
  const { month, dayLabel } = lunarDay(date)
  return `${month}${dayLabel}`
}

/** A traditional festival on this local date, including 除夕 (the eve of 春节). */
export const lunarFestivalOn = (date: Date): string | null => {
  const { month, day } = lunarParts(date)
  const festival = LUNAR_FESTIVALS[`${month}/${day}`]
  if (festival) return festival
  const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12)
  const next = lunarParts(tomorrow)
  return next.month === '正月' && next.day === 1 ? '除夕' : null
}

const BEIJING_OFFSET_MS = 8 * 3600000

/**
 * The solar term that begins on this calendar date. Terms are dated in
 * Beijing time, as printed calendars do, whatever the viewer's timezone.
 */
export const solarTermOn = (date: Date): string | null => {
  const start = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - BEIJING_OFFSET_MS
  const before = Math.floor(sunEclipticLongitude(new Date(start)) / 15)
  const after = Math.floor(sunEclipticLongitude(new Date(start + 86400000)) / 15)
  return before === after ? null : SOLAR_TERMS[after % 24]
}
