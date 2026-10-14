import type { WorldClockItem } from '../../shared/prefs/preferences'

/** The world clock's first city outside your own zone: the one you schedule calls with. */
export const pickSecondZone = (items: readonly WorldClockItem[], homeTimeZone: string) =>
  items.find((item) => item.timeZone !== homeTimeZone) ?? null

const dayKey = (time: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(time)

/**
 * An event's start as the other city reads it: "纽约 22:00", with its weekday when the date
 * there differs from yours ("纽约 周一 22:00").
 */
export const secondZoneLabel = (startAt: number, item: WorldClockItem, homeTimeZone: string, locale: string) => {
  const name = item.alias || item.label.split(',')[0].trim()
  const time = new Intl.DateTimeFormat(locale, { timeZone: item.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(startAt)
  const otherDay = dayKey(startAt, item.timeZone) !== dayKey(startAt, homeTimeZone)
  const weekday = otherDay ? new Intl.DateTimeFormat(locale, { timeZone: item.timeZone, weekday: 'short' }).format(startAt) : ''
  return [name, weekday, time].filter(Boolean).join(' ')
}
