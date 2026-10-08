import type { TaskItem, TaskRecurrence, TaskRecurrenceFrequency } from '../../../data/models/types'
import { createId } from '../../../shared/utils/ids'

export const TASK_RECURRENCE_FREQUENCIES: TaskRecurrenceFrequency[] = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000
// Enough for a daily rule to skip years of missed occurrences; keeps a corrupt rule from spinning.
const MAX_STEPS = 5000

export const normalizeTaskRecurrence = (value: unknown): TaskRecurrence | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const { frequency, interval, monthDay } = value as Record<string, unknown>
  if (!TASK_RECURRENCE_FREQUENCIES.includes(frequency as TaskRecurrenceFrequency)) return undefined
  const rule: TaskRecurrence = {
    frequency: frequency as TaskRecurrenceFrequency,
    interval: frequency === 'weekdays' || typeof interval !== 'number' || !Number.isFinite(interval)
      ? 1
      : Math.min(Math.max(Math.round(interval), 1), 365),
  }
  if ((frequency === 'monthly' || frequency === 'yearly') && typeof monthDay === 'number' && monthDay >= 1 && monthDay <= 31) {
    rule.monthDay = Math.round(monthDay)
  }
  return rule
}

const parseDateKey = (key: string) => {
  const match = DATE_KEY_RE.exec(key)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

export const toRecurrenceDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// Day arithmetic on UTC day numbers, so a DST change can't shift a date.
const dayNumber = (key: string) => {
  const parts = parseDateKey(key)
  return parts ? Date.UTC(parts.year, parts.month, parts.day) / DAY_MS : NaN
}

const fromDayNumber = (value: number) => {
  const date = new Date(value * DAY_MS)
  return toRecurrenceDateKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export const addDaysToKey = (key: string, days: number) => fromDayNumber(dayNumber(key) + days)

export const daysBetweenKeys = (from: string, to: string) => dayNumber(to) - dayNumber(from)

const keyInMonth = (year: number, month: number, day: number) => {
  const first = new Date(year, month, 1)
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return toRecurrenceDateKey(new Date(first.getFullYear(), first.getMonth(), Math.min(day, lastDay)))
}

/**
 * The first date of the series anchored at `anchorKey` that falls strictly after `afterKey`.
 * Monthly and yearly rules land on `monthDay` (or the anchor's day), clamped in short months,
 * so "every month on the 31st" stays on the last day instead of drifting to the 28th.
 */
export const nextRecurrenceDate = (rule: TaskRecurrence, anchorKey: string, afterKey: string): string => {
  const anchor = parseDateKey(anchorKey)
  if (!anchor || !parseDateKey(afterKey)) throw new Error(`Invalid recurrence dates: ${anchorKey} → ${afterKey}`)
  const interval = Math.max(1, rule.interval)
  const after = dayNumber(afterKey)

  if (rule.frequency === 'daily' || rule.frequency === 'weekly') {
    const step = rule.frequency === 'daily' ? interval : interval * 7
    const start = dayNumber(anchorKey)
    const k = start > after ? 0 : Math.floor((after - start) / step) + 1
    return fromDayNumber(start + k * step)
  }

  if (rule.frequency === 'weekdays') {
    let next = Math.max(after + 1, dayNumber(anchorKey))
    for (let i = 0; i < 7; i += 1) {
      const weekday = new Date(next * DAY_MS).getUTCDay()
      if (weekday !== 0 && weekday !== 6) break
      next += 1
    }
    return fromDayNumber(next)
  }

  const day = rule.monthDay ?? anchor.day
  for (let k = 0; k < MAX_STEPS; k += 1) {
    const candidate = rule.frequency === 'monthly'
      ? keyInMonth(anchor.year, anchor.month + k * interval, day)
      : keyInMonth(anchor.year + k * interval, anchor.month, day)
    if (dayNumber(candidate) > after) return candidate
  }
  throw new Error('Recurrence did not reach the target date')
}

export type NextOccurrenceInput = Pick<TaskItem, 'title' | 'description' | 'pinned' | 'priority' | 'tags' | 'subtasks' | 'status'> &
  Partial<Pick<TaskItem, 'projectId' | 'dueDate' | 'startDate' | 'endDate' | 'reminderAt' | 'recurrence'>>

/**
 * What the next occurrence of a repeating task looks like once this one is finished. It is due
 * on the next date after both its own due date and today, so a missed daily task comes back
 * tomorrow, not as a stack of overdue copies. Progress, notes and attachments stay with the
 * finished one; subtasks come back unticked.
 */
export const buildNextOccurrence = (task: TaskItem, now = new Date()): NextOccurrenceInput | null => {
  const rule = normalizeTaskRecurrence(task.recurrence)
  if (!rule) return null
  const todayKey = toRecurrenceDateKey(now)
  const ownDue = task.dueDate && parseDateKey(task.dueDate) ? task.dueDate : undefined
  const anchorKey = ownDue ?? todayKey
  const dueDate = nextRecurrenceDate(rule, anchorKey, anchorKey > todayKey ? anchorKey : todayKey)
  const shift = ownDue ? daysBetweenKeys(ownDue, dueDate) : 0
  const shiftKey = (key?: string) => (ownDue && key && parseDateKey(key) ? addDaysToKey(key, shift) : undefined)

  let reminderAt: number | undefined
  if (typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt)) {
    const target = parseDateKey(dueDate)!
    // Same clock time, moved with the task (local-date setters keep the time across DST).
    const moved = new Date(task.reminderAt)
    if (ownDue) moved.setDate(moved.getDate() + shift)
    else moved.setFullYear(target.year, target.month, target.day)
    reminderAt = moved.getTime()
  }

  return {
    title: task.title,
    description: task.description,
    pinned: task.pinned,
    priority: task.priority,
    projectId: task.projectId,
    tags: [...task.tags],
    subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: createId(), done: false })),
    status: 'todo',
    dueDate,
    startDate: shiftKey(task.startDate),
    endDate: shiftKey(task.endDate),
    reminderAt,
    recurrence: rule,
  }
}

/** Rule from a "frequency:interval" option value, carrying the month day from the due date. */
export const recurrenceFromOption = (value: string, dueDate?: string): TaskRecurrence | undefined => {
  const [frequency, interval] = value.split(':')
  const due = dueDate ? parseDateKey(dueDate) : null
  return normalizeTaskRecurrence({
    frequency,
    interval: Number(interval) || 1,
    monthDay: due?.day ?? new Date().getDate(),
  })
}

export const recurrenceOptionValue = (rule?: TaskRecurrence) =>
  rule ? `${rule.frequency}:${rule.frequency === 'weekdays' ? 1 : rule.interval}` : 'none'
