import type { TaskItem, TaskPriority, TaskRecurrence, TaskStatus } from '../tasks.types'
import type { TranslationKey } from '../../../shared/i18n/types'
import { getTaskCompletion, getTaskDaysUntilDue } from '../domain/taskRules'
import { appIntlLocale } from '../../../shared/i18n/format'

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
  /** overdue: one or more tasks are past due; today: due today; upcoming: due within a week. */
  kind: 'overdue' | 'today' | 'upcoming'
  /** Days until the nearest upcoming due date (0 for today, negative when overdue). */
  daysRemaining: number
  /** How many tasks are overdue (kind === 'overdue'). */
  overdueCount: number
  level: 'watch' | 'soon' | 'urgent'
}

// Paper & Ink: a deadline never tints the whole card — only the date text
// (and, where a chip is unavoidable, a tone wash) carries the state.
const NEUTRAL_BADGE = 'border-transparent bg-paper-sunken text-ink-2'
// A date not yet reached is intention: a dashed pencil outline, pencil text.
const PLANNED_BADGE = 'border-dashed border-pencil-line bg-transparent text-pencil'

const buildDeadlineState = (daysRemaining: number): TaskDeadlineState => {
  if (daysRemaining <= 0) {
    return {
      daysRemaining,
      label: daysRemaining < 0 ? `${daysRemaining}d` : '0d',
      shellClass: '',
      badgeClass: 'border-transparent bg-tone-urgent-wash text-tone-urgent',
      textClass: 'text-tone-urgent',
    }
  }

  if (daysRemaining <= 3) {
    return {
      daysRemaining,
      label: `+${daysRemaining}d`,
      shellClass: '',
      badgeClass: 'border-transparent bg-tone-warn-wash text-tone-warn',
      textClass: 'text-tone-warn',
    }
  }

  // Further out: the date is only intended, so it is written in pencil.
  return {
    daysRemaining,
    label: `+${daysRemaining}d`,
    shellClass: '',
    badgeClass: PLANNED_BADGE,
    textClass: 'text-pencil',
  }
}

export const getTaskDeadlineState = (task: Pick<TaskItem, 'dueDate' | 'status'>, now = Date.now()): TaskDeadlineState => {
  const daysRemaining = getTaskDaysUntilDue(task, now)
  if (daysRemaining == null) {
    return {
      daysRemaining: null,
      label: null,
      shellClass: '',
      badgeClass: NEUTRAL_BADGE,
      textClass: 'text-ink-3',
    }
  }

  // Waiting: the date is when to chase someone. Reaching it asks for attention (ochre), never
  // the vermilion of a missed deadline.
  if (task.status === 'waiting') {
    return daysRemaining <= 0
      ? {
          daysRemaining,
          label: `${daysRemaining}d`,
          shellClass: '',
          badgeClass: 'border-transparent bg-tone-warn-wash text-tone-warn',
          textClass: 'text-tone-warn',
        }
      : { daysRemaining, label: `+${daysRemaining}d`, shellClass: '', badgeClass: PLANNED_BADGE, textClass: 'text-pencil' }
  }

  return buildDeadlineState(daysRemaining)
}

export const getUpcomingDeadlineAlert = (
  items: Array<Pick<TaskItem, 'dueDate' | 'status'>>,
  now = Date.now(),
): TaskDeadlineAlert | null => {
  let overdueCount = 0
  let nearest: number | null = null
  for (const item of items) {
    // A waiting task's date is a chase date, not a deadline.
    if (item.status === 'waiting') continue
    const days = getTaskDaysUntilDue(item, now)
    if (days == null) continue
    if (days < 0) overdueCount += 1
    else if (days <= 7 && (nearest == null || days < nearest)) nearest = days
  }

  // Overdue outranks everything: the tab must not read "due in 3 days" while a task is late.
  if (overdueCount > 0) return { kind: 'overdue', daysRemaining: -1, overdueCount, level: 'urgent' }
  if (nearest == null) return null
  return {
    kind: nearest === 0 ? 'today' : 'upcoming',
    daysRemaining: nearest,
    overdueCount: 0,
    level: nearest <= 1 ? 'urgent' : nearest <= 3 ? 'soon' : 'watch',
  }
}

type TaskStatusLabelKey = `tasks.status.${TaskStatus}`

// DESIGN.md › three hands: waiting is pencil (intended, not in your hands), verify takes the info
// tone (a claim to check), dropped recedes to the faintest ink.
export const TASK_STATUS_CONFIG: Record<TaskStatus, { labelKey: TaskStatusLabelKey; dot: string; badge: string }> = {
  todo: {
    labelKey: 'tasks.status.todo',
    dot: 'bg-[var(--status-todo)]',
    badge: 'border-transparent bg-paper-sunken text-ink-2',
  },
  doing: {
    labelKey: 'tasks.status.doing',
    dot: 'bg-[var(--status-doing)]',
    badge: 'border-transparent bg-tone-warn-wash text-tone-warn',
  },
  waiting: {
    labelKey: 'tasks.status.waiting',
    dot: 'bg-[var(--pencil)]',
    badge: 'border-dashed border-[color:var(--pencil-line)] bg-transparent text-[color:var(--pencil)]',
  },
  verify: {
    labelKey: 'tasks.status.verify',
    dot: 'bg-tone-info',
    badge: 'border-transparent bg-tone-info-wash text-tone-info',
  },
  done: {
    labelKey: 'tasks.status.done',
    dot: 'bg-[var(--status-done)]',
    badge: 'border-transparent bg-tone-done-wash text-tone-done',
  },
  dropped: {
    labelKey: 'tasks.status.dropped',
    dot: 'bg-ink-4',
    badge: 'border-transparent bg-paper-sunken text-ink-3',
  },
}

/** Short label for a repeat rule: 每天, 每 2 周, 每月 31 日… */
export const describeTaskRecurrence = (
  rule: TaskRecurrence | undefined,
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
) => {
  if (!rule) return null
  const n = Math.max(1, rule.interval)
  switch (rule.frequency) {
    case 'daily':
      return n === 1 ? t('tasks.recurrence.daily') : t('tasks.recurrence.everyNDays', { n })
    case 'weekdays':
      return t('tasks.recurrence.weekdays')
    case 'weekly':
      return n === 1 ? t('tasks.recurrence.weekly') : t('tasks.recurrence.everyNWeeks', { n })
    case 'monthly':
      if (n !== 1) return t('tasks.recurrence.everyNMonths', { n })
      return rule.monthDay ? t('tasks.recurrence.monthlyOn', { day: rule.monthDay }) : t('tasks.recurrence.monthly')
    case 'yearly':
      return n === 1 ? t('tasks.recurrence.yearly') : t('tasks.recurrence.everyNYears', { n })
    default:
      return null
  }
}

export const TASK_PRIORITY_CONFIG: Record<NonNullable<TaskPriority> | 'none', { labelKey: 'tasks.priority.high' | 'tasks.priority.medium' | 'tasks.priority.low' | 'tasks.priority.none'; dot: string; badge: string }> = {
  high: {
    labelKey: 'tasks.priority.high',
    dot: 'bg-tone-urgent',
    badge: 'bg-tone-urgent-wash text-tone-urgent',
  },
  medium: {
    labelKey: 'tasks.priority.medium',
    dot: 'bg-tone-warn',
    badge: 'bg-tone-warn-wash text-tone-warn',
  },
  low: {
    labelKey: 'tasks.priority.low',
    dot: 'bg-ink-3',
    badge: 'bg-paper-sunken text-ink-2',
  },
  none: {
    labelKey: 'tasks.priority.none',
    dot: 'bg-ink-4',
    badge: 'bg-paper-sunken text-ink-3',
  },
}

export const getTaskPriorityKey = (priority: TaskPriority | null | undefined) => priority ?? 'none'

// Tags are categories, and categories don't get color (DESIGN.md rule 2):
// every tag is the same quiet chip.
export const getTaskTagTone = (tag: string): TaskTagTone => {
  void tag
  return { dot: 'bg-ink-4', badge: 'bg-paper-sunken text-ink-2' }
}

export const formatTaskDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(appIntlLocale(), { month: 'short', day: 'numeric' })
}

export const formatTaskDateTime = (value: number) =>
  new Date(value).toLocaleString(appIntlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export { getTaskCompletion }
