import type { LanguageCode, TranslationKey } from '../../shared/i18n/types'

export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string

const pad = (value: number) => String(value).padStart(2, '0')

/** Minutes after midnight as 09:00. */
export const formatClock = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`

/** An instant's local time of day as 09:00. */
export const formatTimeOfDay = (time: number) => {
  const date = new Date(time)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const parseClock = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null
  return hours * 60 + minutes
}

/** Whole minutes, as "21 小时 27 分钟" / "21 h 27 min". */
export const formatWorkDuration = (seconds: number, t: Translate) => {
  const total = Math.floor(seconds / 60)
  if (total < 1) return t('salary.duration.lessThanMinute')
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return t('salary.duration.m', { m })
  if (m === 0) return t('salary.duration.h', { h })
  return t('salary.duration.hm', { h, m })
}

export const localeOf = (language: LanguageCode) => (language === 'zh' ? 'zh-CN' : 'en-US')

export const formatMoney = (amount: number, symbol: string, language: LanguageCode, digits = 2) =>
  `${symbol}${amount.toLocaleString(localeOf(language), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

/** A per-second rate keeps four significant digits: ¥0.01812. */
export const formatRate = (amount: number, symbol: string, language: LanguageCode) =>
  `${symbol}${amount.toLocaleString(localeOf(language), { maximumSignificantDigits: 4 })}`
