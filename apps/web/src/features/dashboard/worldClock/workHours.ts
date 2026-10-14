/** Where a city is in its working day, for "is now a good time to write to them". */

export const DEFAULT_WORK_START = 9 * 60
export const DEFAULT_WORK_END = 18 * 60
const CLOSING_MINUTES = 60

export type WorkState =
  | { kind: 'working'; minutesLeft: number }
  | { kind: 'closing'; minutesLeft: number }
  | { kind: 'before'; startsAt: number }
  | { kind: 'after' }
  | { kind: 'weekend' }
  | { kind: 'holiday'; name: string }

/**
 * The state at a city's local time: minutes after midnight and weekday (0 = Sunday) there.
 * Monday to Friday are working days; a holiday name wins over everything.
 */
export const workStateAt = (
  localMinutes: number,
  localWeekday: number,
  hours: { start?: number; end?: number } = {},
  holidayName?: string | null,
): WorkState => {
  if (holidayName) return { kind: 'holiday', name: holidayName }
  if (localWeekday === 0 || localWeekday === 6) return { kind: 'weekend' }
  const start = hours.start ?? DEFAULT_WORK_START
  const end = hours.end ?? DEFAULT_WORK_END
  if (localMinutes < start) return { kind: 'before', startsAt: start }
  if (localMinutes >= end) return { kind: 'after' }
  const minutesLeft = end - localMinutes
  return minutesLeft <= CLOSING_MINUTES ? { kind: 'closing', minutesLeft } : { kind: 'working', minutesLeft }
}

/** "09:00" for minutes after midnight. */
export const clockOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Minutes after midnight for "HH:MM", or null. */
export const minutesOf = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null
}
