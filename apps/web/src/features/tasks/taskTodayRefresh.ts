const RESET_HOUR = 4
const RESET_KEY = 'focusgo.tasks.todayResetBucket'

const pad = (value: number) => `${value}`.padStart(2, '0')

const shiftToResetWindow = (timestamp: number) => timestamp - RESET_HOUR * 60 * 60 * 1000

const getEffectiveDate = (timestamp: number) => new Date(shiftToResetWindow(timestamp))

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const getCurrentTaskTodayBucket = (now = Date.now()) =>
  toDateKey(getEffectiveDate(now))

export const readTaskTodayBucket = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(RESET_KEY)
}

export const writeTaskTodayBucket = (bucket: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(RESET_KEY, bucket)
}

/**
 * Returns whether done today-tasks should be cleared from the today list.
 * Requires a previous bucket to have been stored — on first run it just
 * initialises the bucket without clearing (consistent with widgetTodoRefresh).
 */
export const shouldClearTodayDoneTasks = (lastBucket: string | null, now = Date.now()) => {
  const currentBucket = getCurrentTaskTodayBucket(now)
  return {
    shouldClear: lastBucket !== null && lastBucket !== currentBucket,
    currentBucket,
  }
}
