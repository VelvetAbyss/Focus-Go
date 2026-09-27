import { readLanguage } from '../prefs/preferences'
import { t } from './translator'
import type { LanguageCode } from './types'

/** Intl locale for the app's chosen language (not the browser's). */
export const intlLocaleFor = (language: LanguageCode) => (language === 'zh' ? 'zh-CN' : 'en-US')

/**
 * For formatting helpers outside React: the language persisted in preferences.
 * Falls back to the runtime default where storage is unavailable (SSR/tests).
 */
export const appIntlLocale = (): string | undefined => {
  try {
    return intlLocaleFor(readLanguage())
  } catch {
    return undefined
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Compact relative time ("5m ago" / "5 分钟前"). Past `maxDays` it falls back
 * to a short localized date.
 */
export const formatRelativeTime = (time: number, language: LanguageCode, options: { now?: number; maxDays?: number } = {}) => {
  const { now = Date.now(), maxDays = 7 } = options
  const diff = now - time
  if (diff < MINUTE) return t('common.time.justNow', language)
  if (diff < HOUR) return t('common.time.minutesAgo', language, { n: Math.floor(diff / MINUTE) })
  if (diff < DAY) return t('common.time.hoursAgo', language, { n: Math.floor(diff / HOUR) })
  if (diff < maxDays * DAY) return t('common.time.daysAgo', language, { n: Math.floor(diff / DAY) })
  return new Date(time).toLocaleDateString(intlLocaleFor(language), { month: 'short', day: 'numeric' })
}
