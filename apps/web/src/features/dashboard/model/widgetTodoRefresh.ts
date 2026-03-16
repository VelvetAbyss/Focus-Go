import type { WidgetTodo, WidgetTodoScope } from '../../../data/models/types'

const RESET_HOUR = 4
const RESET_KEY_PREFIX = 'focusgo.widgetTodos.reset.'

const shiftToResetWindow = (timestamp: number) => timestamp - RESET_HOUR * 60 * 60 * 1000

const pad = (value: number) => `${value}`.padStart(2, '0')

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const getEffectiveDate = (timestamp: number) => new Date(shiftToResetWindow(timestamp))

const getIsoWeekParts = (date: Date) => {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = local.getDay() || 7
  local.setDate(local.getDate() + 4 - day)
  const weekYear = local.getFullYear()
  const yearStart = new Date(weekYear, 0, 1)
  const week = Math.ceil((((local.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return { weekYear, week }
}

const getCurrentBucketStartDate = (scope: WidgetTodoScope, timestamp: number) => {
  const effective = getEffectiveDate(timestamp)
  if (scope === 'day') {
    return new Date(effective.getFullYear(), effective.getMonth(), effective.getDate(), RESET_HOUR, 0, 0, 0)
  }
  if (scope === 'week') {
    const start = new Date(effective.getFullYear(), effective.getMonth(), effective.getDate(), RESET_HOUR, 0, 0, 0)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - (day - 1))
    return start
  }
  return new Date(effective.getFullYear(), effective.getMonth(), 1, RESET_HOUR, 0, 0, 0)
}

export const getCurrentTodoResetBucket = (scope: WidgetTodoScope, now = Date.now()) => {
  const effective = getEffectiveDate(now)
  if (scope === 'day') return toDateKey(effective)
  if (scope === 'week') {
    const { weekYear, week } = getIsoWeekParts(effective)
    return `${weekYear}-W${pad(week)}`
  }
  return `${effective.getFullYear()}-${pad(effective.getMonth() + 1)}`
}

export const getCurrentTodoResetBoundary = (scope: WidgetTodoScope, now = Date.now()) =>
  getCurrentBucketStartDate(scope, now).getTime()

export const shouldResetWidgetTodos = (scope: WidgetTodoScope, lastBucket: string | null, now = Date.now()) => {
  const currentBucket = getCurrentTodoResetBucket(scope, now)
  return {
    shouldReset: lastBucket !== null && lastBucket !== currentBucket,
    currentBucket,
  }
}

export const readWidgetTodoResetBucket = (scope: WidgetTodoScope) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null
  return window.localStorage.getItem(`${RESET_KEY_PREFIX}${scope}`)
}

export const writeWidgetTodoResetBucket = (scope: WidgetTodoScope, bucket: string) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  window.localStorage.setItem(`${RESET_KEY_PREFIX}${scope}`, bucket)
}

export const shouldBootstrapResetWidgetTodos = (items: WidgetTodo[], scope: WidgetTodoScope, now = Date.now()) => {
  const boundary = getCurrentTodoResetBoundary(scope, now)
  return items.some((item) => item.scope === scope && item.done && item.updatedAt < boundary)
}
