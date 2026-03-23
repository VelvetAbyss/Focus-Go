import type { TaskItem, TaskPriority, TaskStatus } from '../tasks.types'

export type TaskTagTone = {
  dot: string
  badge: string
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; badge: string }> = {
  todo: {
    label: '待办',
    dot: 'bg-stone-400',
    badge: 'border-stone-300 bg-stone-100 text-stone-700',
  },
  doing: {
    label: '进行中',
    dot: 'bg-teal-500',
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
  },
  done: {
    label: '已完成',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
}

export const TASK_PRIORITY_CONFIG: Record<NonNullable<TaskPriority> | 'none', { label: string; dot: string; badge: string }> = {
  high: {
    label: '高',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700',
  },
  medium: {
    label: '中',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
  },
  low: {
    label: '低',
    dot: 'bg-cyan-600',
    badge: 'bg-cyan-50 text-cyan-700',
  },
  none: {
    label: '无',
    dot: 'bg-stone-300',
    badge: 'bg-stone-100 text-stone-500',
  },
}

export const getTaskPriorityKey = (priority: TaskPriority | null | undefined) => priority ?? 'none'

export const getTaskTagTone = (tag: string): TaskTagTone => {
  const key = tag.toLowerCase()
  if (key === 'work') return { dot: 'bg-teal-600', badge: 'bg-teal-50 text-teal-700' }
  if (key === 'life') return { dot: 'bg-fuchsia-500', badge: 'bg-fuchsia-50 text-fuchsia-700' }
  if (key === 'health') return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' }
  if (key === 'study') return { dot: 'bg-cyan-600', badge: 'bg-cyan-50 text-cyan-700' }
  if (key === 'finance') return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' }
  if (key === 'family') return { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' }
  return { dot: 'bg-stone-400', badge: 'bg-stone-100 text-stone-700' }
}

export const formatTaskDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const formatTaskDateTime = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const getTaskCompletion = (task: Pick<TaskItem, 'subtasks'>) => {
  if (task.subtasks.length === 0) return null
  const completed = task.subtasks.filter((item) => item.done).length
  return { completed, total: task.subtasks.length }
}
