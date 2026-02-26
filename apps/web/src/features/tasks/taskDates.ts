import type { TaskItem } from './tasks.types'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

const normalizeDateKey = (value?: string) => {
  if (typeof value !== 'string') return undefined
  const next = value.trim()
  return DATE_KEY_RE.test(next) ? next : undefined
}

export const getTaskDisplayRange = (task: TaskItem) => {
  const dueDate = normalizeDateKey(task.dueDate)
  const startDate = normalizeDateKey(task.startDate)
  const endDate = normalizeDateKey(task.endDate)

  if (startDate && endDate) {
    return startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate }
  }
  if (startDate) return { startDate, endDate: startDate }
  if (endDate) return { startDate: endDate, endDate }
  if (dueDate) return { startDate: dueDate, endDate: dueDate }
  return null
}

export const taskCoversDate = (task: TaskItem, dateKey: string) => {
  const range = getTaskDisplayRange(task)
  if (!range) return false
  return range.startDate <= dateKey && dateKey <= range.endDate
}

export const formatTaskDateRange = (task: TaskItem) => {
  const range = getTaskDisplayRange(task)
  if (!range) return 'No date'
  if (range.startDate === range.endDate) return range.startDate
  return `${range.startDate} -> ${range.endDate}`
}
