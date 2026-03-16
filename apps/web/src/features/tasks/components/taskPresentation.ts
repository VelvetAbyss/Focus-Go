import type { TaskItem, TaskPriority, TaskStatus } from '../tasks.types'

export type TaskTagTone = {
  dot: string
  badge: string
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; badge: string }> = {
  todo: {
    label: 'Todo',
    dot: 'bg-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  doing: {
    label: 'Doing',
    dot: 'bg-sky-500',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  done: {
    label: 'Done',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
}

export const TASK_PRIORITY_CONFIG: Record<NonNullable<TaskPriority> | 'none', { label: string; dot: string; badge: string }> = {
  high: {
    label: 'High',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
  },
  low: {
    label: 'Low',
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700',
  },
  none: {
    label: 'None',
    dot: 'bg-slate-300',
    badge: 'bg-slate-100 text-slate-500',
  },
}

export const getTaskPriorityKey = (priority: TaskPriority | null | undefined) => priority ?? 'none'

export const getTaskTagTone = (tag: string): TaskTagTone => {
  const key = tag.toLowerCase()
  if (key === 'work') return { dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700' }
  if (key === 'life') return { dot: 'bg-fuchsia-500', badge: 'bg-fuchsia-50 text-fuchsia-700' }
  if (key === 'health') return { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' }
  if (key === 'study') return { dot: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700' }
  if (key === 'finance') return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' }
  if (key === 'family') return { dot: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' }
  return { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' }
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
