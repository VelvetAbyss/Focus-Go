import type { CalendarEvent } from './calendar.model'
import { lunarDay, lunarFestivalOn } from '../dashboard/header/chineseDay'

/**
 * The 农历 calendar's days, worked out from the Chinese calendar built into the
 * browser (Intl), so it needs no network and covers any year. As on a printed
 * calendar, the first day of a month shows the month and a festival replaces
 * the day.
 */
export const buildLunarEvents = (dateKeys: string[], subscriptionId: string): CalendarEvent[] =>
  dateKeys.map((dateKey) => {
    const date = new Date(`${dateKey}T12:00:00`)
    const { month, day, dayLabel } = lunarDay(date)
    return {
      id: `${subscriptionId}-${dateKey}`,
      subscriptionId,
      title: lunarFestivalOn(date) ?? (day === 1 ? month : dayLabel),
      dateKey,
      kind: 'lunar',
    }
  })
