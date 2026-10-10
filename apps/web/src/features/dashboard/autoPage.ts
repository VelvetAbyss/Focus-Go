import { readSalaryState } from '../salary/salaryStorage'

/**
 * Opening the dashboard on the page that fits the hour: 专注 during working hours, 生活 the rest
 * of the time. Off unless turned on in Settings; a page picked by hand holds for the rest of the day.
 * A device choice, kept in this browser.
 */
export const AUTO_PAGE_KEY = 'focusgo.dashboard.autoPage'
const MANUAL_PAGE_KEY = 'focusgo.dashboard.autoPage.manual'

export type AutoPage = 'main' | 'life'

const DEFAULT_HOURS = { workStart: 9 * 60, workEnd: 18 * 60, workdays: [1, 2, 3, 4, 5] }

const dayKeyOf = (date: Date) => date.toLocaleDateString('en-CA')

export const readAutoPageEnabled = () => {
  try {
    return window.localStorage.getItem(AUTO_PAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const writeAutoPageEnabled = (enabled: boolean) => {
  try {
    window.localStorage.setItem(AUTO_PAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // private mode: the switch just won't stick
  }
}

/** Working hours: the pay settings' days and hours when set, else Monday to Friday, 9:00–18:00. */
export const isWorkingTime = (now: Date, hours: { workStart: number; workEnd: number; workdays: number[] } = DEFAULT_HOURS) => {
  const minutes = now.getHours() * 60 + now.getMinutes()
  return hours.workdays.includes(now.getDay()) && minutes >= hours.workStart && minutes < hours.workEnd
}

/** Remembers a page picked by hand today, so the automatic choice leaves it alone until tomorrow. */
export const rememberManualPage = (page: AutoPage, now = new Date()) => {
  try {
    window.localStorage.setItem(MANUAL_PAGE_KEY, JSON.stringify({ day: dayKeyOf(now), page }))
  } catch {
    // ignore
  }
}

const readManualPage = (now: Date): AutoPage | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MANUAL_PAGE_KEY) ?? 'null') as { day?: string; page?: string } | null
    return parsed?.day === dayKeyOf(now) && (parsed.page === 'main' || parsed.page === 'life') ? parsed.page : null
  } catch {
    return null
  }
}

/** The page the dashboard opens on: 专注 unless the automatic choice is on and says otherwise. */
export const initialDashboardPage = (now = new Date()): AutoPage => {
  if (!readAutoPageEnabled()) return 'main'
  const manual = readManualPage(now)
  if (manual) return manual
  const settings = readSalaryState().settings
  return isWorkingTime(now, settings ?? DEFAULT_HOURS) ? 'main' : 'life'
}
