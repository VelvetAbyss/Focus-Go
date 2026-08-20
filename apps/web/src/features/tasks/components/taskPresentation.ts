import type { TaskItem, TaskPriority, TaskStatus } from '../tasks.types'
import { getTaskCompletion, getTaskDaysUntilDue } from '../domain/taskRules'

export type TaskTagTone = {
  dot: string
  badge: string
}

export type TaskDeadlineState = {
  daysRemaining: number | null
  label: string | null
  shellClass: string
  badgeClass: string
  textClass: string
}

export type TaskDeadlineAlert = {
  daysRemaining: number
  label: string
  level: 'watch' | 'soon' | 'urgent'
}

const buildDeadlineState = (daysRemaining: number): TaskDeadlineState => {
  if (daysRemaining < 0) {
    return {
      daysRemaining,
      label: `${daysRemaining}d`,
      shellClass: '!border-rose-300/70 !bg-rose-50/80',
      badgeClass: 'border-rose-300 bg-rose-100 text-rose-700',
      textClass: 'text-rose-700',
    }
  }

  if (daysRemaining === 0) {
    return {
      daysRemaining,
      label: '0d',
      shellClass: '!border-rose-300/60 !bg-rose-50/70',
      badgeClass: 'border-rose-300 bg-rose-100 text-rose-700',
      textClass: 'text-rose-700',
    }
  }

  if (daysRemaining <= 3) {
    return {
      daysRemaining,
      label: `+${daysRemaining}d`,
      shellClass: '!border-orange-300/60 !bg-orange-50/70',
      badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
      textClass: 'text-orange-700',
    }
  }

  if (daysRemaining <= 7) {
    return {
      daysRemaining,
      label: `+${daysRemaining}d`,
      shellClass: '!border-amber-200/70 !bg-amber-50/70',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      textClass: 'text-amber-700',
    }
  }

  return {
    daysRemaining,
    label: `+${daysRemaining}d`,
    shellClass: '',
    badgeClass: 'border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] text-[color-mix(in_srgb,var(--text-primary)_70%,transparent)]',
    textClass: 'text-muted-foreground',
  }
}

export const getTaskDeadlineState = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()): TaskDeadlineState => {
  const daysRemaining = getTaskDaysUntilDue(task, now)
  if (daysRemaining == null) {
    return {
      daysRemaining: null,
      label: null,
      shellClass: '',
      badgeClass: 'border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] text-[color-mix(in_srgb,var(--text-primary)_70%,transparent)]',
      textClass: 'text-muted-foreground',
    }
  }

  return buildDeadlineState(daysRemaining)
}

export const getUpcomingDeadlineAlert = (
  items: Array<Pick<TaskItem, 'dueDate' | 'status'>>,
  now = Date.now(),
): TaskDeadlineAlert | null => {
  const nearest = items.reduce<number | null>((min, item) => {
    const state = getTaskDeadlineState(item, now)
    if (state.daysRemaining == null || state.daysRemaining < 1 || state.daysRemaining > 7) return min
    return min == null ? state.daysRemaining : Math.min(min, state.daysRemaining)
  }, null)

  if (nearest == null) return null
  return {
    daysRemaining: nearest,
    label: `${nearest}d`,
    level: nearest <= 1 ? 'urgent' : nearest <= 3 ? 'soon' : 'watch',
  }
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { labelKey: 'tasks.status.todo' | 'tasks.status.doing' | 'tasks.status.done'; dot: string; badge: string }> = {
  todo: {
    labelKey: 'tasks.status.todo',
    dot: 'bg-stone-400',
    badge: 'border-stone-300 bg-stone-100 text-stone-700',
  },
  doing: {
    labelKey: 'tasks.status.doing',
    dot: 'bg-teal-500',
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
  },
  done: {
    labelKey: 'tasks.status.done',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
}

export const TASK_PRIORITY_CONFIG: Record<NonNullable<TaskPriority> | 'none', { labelKey: 'tasks.priority.high' | 'tasks.priority.medium' | 'tasks.priority.low' | 'tasks.priority.none'; dot: string; badge: string }> = {
  high: {
    labelKey: 'tasks.priority.high',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700',
  },
  medium: {
    labelKey: 'tasks.priority.medium',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
  },
  low: {
    labelKey: 'tasks.priority.low',
    dot: 'bg-cyan-600',
    badge: 'bg-cyan-50 text-cyan-700',
  },
  none: {
    labelKey: 'tasks.priority.none',
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

export { getTaskCompletion }
