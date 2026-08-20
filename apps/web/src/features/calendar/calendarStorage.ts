import {
  buildInitialCalendarSubscriptions,
  removeAllSystemSubscriptions,
  sortSubscriptions,
  type CalendarSubscription,
} from './calendar.model'

export const STORAGE_SUBSCRIPTIONS_KEY = 'focusgo.calendar.subscriptions.v1'
export const STORAGE_ICS_EVENTS_KEY = 'focusgo.calendar.icsEvents.v1'
export const STORAGE_TASK_COLORS_KEY = 'focusgo.calendar.taskColors.v1'

export const readStoredSubscriptions = () => {
  if (typeof window === 'undefined') return buildInitialCalendarSubscriptions()

  try {
    const raw = window.localStorage.getItem(STORAGE_SUBSCRIPTIONS_KEY)
    if (!raw) return buildInitialCalendarSubscriptions()
    const parsed = JSON.parse(raw) as CalendarSubscription[]
    if (!Array.isArray(parsed) || parsed.length === 0) return buildInitialCalendarSubscriptions()
    return sortSubscriptions(removeAllSystemSubscriptions(parsed))
  } catch {
    return buildInitialCalendarSubscriptions()
  }
}

export const writeStoredSubscriptions = (subscriptions: CalendarSubscription[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions))
}
