import type { TaskItem, TaskPriority } from '../tasks.types'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

export type TaskDateRange = {
  startDate: string
  endDate: string
}

export const normalizeTaskDateKey = (value?: string) => {
  if (typeof value !== 'string') return undefined
  const next = value.trim()
  return DATE_KEY_RE.test(next) ? next : undefined
}

export const parseDateOnlyToLocalDayStart = (value?: string) => {
  const dateKey = normalizeTaskDateKey(value)
  if (!dateKey) return null
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10))
  return new Date(year, month - 1, day).getTime()
}

export const toLocalDayStart = (value: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export const getTaskDaysUntilDue = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()) => {
  if (isTaskClosed(task)) return null
  const dueDay = parseDateOnlyToLocalDayStart(task.dueDate)
  if (dueDay == null) return null
  return Math.round((dueDay - toLocalDayStart(now)) / DAY_MS)
}

/** Finished — counts as completed work. */
export const isTaskDone = (task: Pick<TaskItem, 'status'>) => task.status === 'done'

/** Off the list for good: finished or deliberately dropped. */
export const isTaskClosed = (task: Pick<TaskItem, 'status'>) => task.status === 'done' || task.status === 'dropped'

export const isTaskOpen = (task: Pick<TaskItem, 'status'>) => !isTaskClosed(task)

/**
 * Past due and still yours to do. A task waiting on someone else is never "overdue": its date is
 * when to chase them, and painting it red would blame you for what you can't control.
 */
export const isTaskOverdue = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()) => {
  if (task.status === 'waiting') return false
  const daysUntilDue = getTaskDaysUntilDue(task, now)
  return daysUntilDue != null && daysUntilDue < 0
}

/** Waiting on someone, and the date to chase them has come. */
export const isTaskFollowUpDue = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()) => {
  if (task.status !== 'waiting') return false
  const dueDay = parseDateOnlyToLocalDayStart(task.dueDate)
  return dueDay != null && dueDay <= toLocalDayStart(now)
}

/** Whole days a waiting task has been waiting, or null if it isn't waiting. */
export const getTaskWaitingDays = (task: Pick<TaskItem, 'status' | 'waitingSince'>, now = Date.now()) => {
  if (task.status !== 'waiting' || typeof task.waitingSince !== 'number') return null
  return Math.max(0, Math.round((toLocalDayStart(now) - toLocalDayStart(task.waitingSince)) / DAY_MS))
}

/**
 * Whether a task belongs in the 今日 view: marked for today by hand, due today (done or not, so
 * today's finished work stays visible), overdue and still open, or waiting with its chase date
 * come. Dropped tasks never show.
 */
export const isTaskInToday = (task: Pick<TaskItem, 'isToday' | 'dueDate' | 'status'>, now = Date.now()) => {
  if (task.status === 'dropped') return false
  if (task.isToday) return true
  const dueDay = parseDateOnlyToLocalDayStart(task.dueDate)
  if (dueDay == null) return false
  if (dueDay === toLocalDayStart(now)) return true
  return isTaskOverdue(task, now) || isTaskFollowUpDue(task, now)
}

export const isTaskBlocked = (task: Pick<TaskItem, 'isBlocked' | 'blockedByTaskIds'>) =>
  task.isBlocked === true || (task.blockedByTaskIds?.length ?? 0) > 0

export const getTaskDateRange = (task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>): TaskDateRange | null => {
  const dueDate = normalizeTaskDateKey(task.dueDate)
  const startDate = normalizeTaskDateKey(task.startDate)
  const endDate = normalizeTaskDateKey(task.endDate)

  if (startDate && endDate) {
    return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate }
  }
  // A start date with a later due date spans to the due date (the calendar shows the
  // whole stretch, ending on the day it's due), rather than only the start day.
  if (startDate) return { startDate, endDate: dueDate && dueDate > startDate ? dueDate : startDate }
  if (endDate) return { startDate: endDate, endDate }
  if (dueDate) return { startDate: dueDate, endDate: dueDate }
  return null
}

export const taskCoversDate = (task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>, dateKey: string) => {
  const range = getTaskDateRange(task)
  if (!range) return false
  return range.startDate <= dateKey && dateKey <= range.endDate
}

export const formatTaskDateRange = (
  task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>,
  formatDateKey: (dateKey: string) => string = (dateKey) => dateKey,
) => {
  const range = getTaskDateRange(task)
  if (!range) return '—'
  if (range.startDate === range.endDate) return formatDateKey(range.startDate)
  return `${formatDateKey(range.startDate)} – ${formatDateKey(range.endDate)}`
}

export const getTaskCompletion = (task: Pick<TaskItem, 'subtasks'>) => {
  if (task.subtasks.length === 0) return null
  const completed = task.subtasks.filter((item) => item.done).length
  return { completed, total: task.subtasks.length }
}

const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

export const rankNextActionTask = (
  left: Pick<TaskItem, 'priority' | 'dueDate' | 'createdAt'>,
  right: Pick<TaskItem, 'priority' | 'dueDate' | 'createdAt'>,
) => {
  const leftScore = left.priority ? priorityOrder[left.priority] : Number.POSITIVE_INFINITY
  const rightScore = right.priority ? priorityOrder[right.priority] : Number.POSITIVE_INFINITY
  if (leftScore !== rightScore) return leftScore - rightScore

  const dueOrder = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
  if (dueOrder !== 0) return dueOrder

  return left.createdAt - right.createdAt
}
