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
  if (isTaskDone(task)) return null
  const dueDay = parseDateOnlyToLocalDayStart(task.dueDate)
  if (dueDay == null) return null
  return Math.round((dueDay - toLocalDayStart(now)) / DAY_MS)
}

export const isTaskDone = (task: Pick<TaskItem, 'status'>) => task.status === 'done'

export const isTaskBlocked = (task: Pick<TaskItem, 'isBlocked' | 'blockedByTaskIds'>) =>
  task.isBlocked === true || (task.blockedByTaskIds?.length ?? 0) > 0

export const isTaskOverdue = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()) => {
  const daysUntilDue = getTaskDaysUntilDue(task, now)
  return daysUntilDue != null && daysUntilDue < 0
}

export const getTaskDateRange = (task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>): TaskDateRange | null => {
  const dueDate = normalizeTaskDateKey(task.dueDate)
  const startDate = normalizeTaskDateKey(task.startDate)
  const endDate = normalizeTaskDateKey(task.endDate)

  if (startDate && endDate) {
    return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate }
  }
  if (startDate) return { startDate, endDate: startDate }
  if (endDate) return { startDate: endDate, endDate }
  if (dueDate) return { startDate: dueDate, endDate: dueDate }
  return null
}

export const taskCoversDate = (task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>, dateKey: string) => {
  const range = getTaskDateRange(task)
  if (!range) return false
  return range.startDate <= dateKey && dateKey <= range.endDate
}

export const formatTaskDateRange = (task: Pick<TaskItem, 'dueDate' | 'startDate' | 'endDate'>) => {
  const range = getTaskDateRange(task)
  if (!range) return 'No date'
  if (range.startDate === range.endDate) return range.startDate
  return `${range.startDate} -> ${range.endDate}`
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
