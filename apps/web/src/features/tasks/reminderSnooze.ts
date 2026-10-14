import { readSalaryState } from '../salary/salaryStorage'

const DEFAULT_START_MINUTES = 9 * 60

/** When the working day starts, in minutes after midnight: the pay settings' start if set, else 9:00. */
export const workStartMinutes = () => readSalaryState().settings?.workStart ?? DEFAULT_START_MINUTES

/**
 * The next start of a working morning: later today if it hasn't come yet
 * (a reminder at 2am snoozes to this morning), otherwise tomorrow.
 */
export const nextMorning = (now: Date, startMinutes = DEFAULT_START_MINUTES) => {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(startMinutes / 60), startMinutes % 60)
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1)
  return { at, today: at.getDate() === now.getDate() && at.getMonth() === now.getMonth() }
}

export const formatClockMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
