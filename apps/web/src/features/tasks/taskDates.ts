import type { TaskItem } from './tasks.types'
import { formatTaskDateRange, getTaskDateRange, taskCoversDate } from './domain/taskRules'

export const getTaskDisplayRange = (task: TaskItem) => {
  return getTaskDateRange(task)
}

export { formatTaskDateRange, taskCoversDate }
