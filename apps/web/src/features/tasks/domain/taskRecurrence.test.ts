import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../tasks.types'
import { buildNextOccurrence, nextRecurrenceDate, normalizeTaskRecurrence, recurrenceFromOption } from './taskRecurrence'

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: 'task-1',
  createdAt: 1,
  updatedAt: 1,
  title: '交周报',
  description: '每周五前发给老板',
  pinned: false,
  isToday: false,
  status: 'done',
  priority: 'high',
  tags: ['工作'],
  subtasks: [{ id: 's1', title: '汇总数据', done: true }],
  taskNoteBlocks: [],
  activityLogs: [],
  ...overrides,
})

describe('nextRecurrenceDate', () => {
  it('steps daily and weekly rules past the target date', () => {
    expect(nextRecurrenceDate({ frequency: 'daily', interval: 1 }, '2026-10-08', '2026-10-08')).toBe('2026-10-09')
    // Missed for days: the next one is after today, not a pile of overdue copies.
    expect(nextRecurrenceDate({ frequency: 'daily', interval: 1 }, '2026-10-01', '2026-10-08')).toBe('2026-10-09')
    expect(nextRecurrenceDate({ frequency: 'daily', interval: 3 }, '2026-10-01', '2026-10-08')).toBe('2026-10-10')
    expect(nextRecurrenceDate({ frequency: 'weekly', interval: 1 }, '2026-10-09', '2026-10-09')).toBe('2026-10-16')
    // Every two weeks keeps its own rhythm even when completed late.
    expect(nextRecurrenceDate({ frequency: 'weekly', interval: 2 }, '2026-09-25', '2026-10-08')).toBe('2026-10-09')
  })

  it('skips weekends for weekday rules', () => {
    // 2026-10-09 is a Friday.
    expect(nextRecurrenceDate({ frequency: 'weekdays', interval: 1 }, '2026-10-09', '2026-10-09')).toBe('2026-10-12')
    expect(nextRecurrenceDate({ frequency: 'weekdays', interval: 1 }, '2026-10-07', '2026-10-07')).toBe('2026-10-08')
  })

  it('keeps month-end rules on the month end instead of drifting', () => {
    const rule = { frequency: 'monthly' as const, interval: 1, monthDay: 31 }
    expect(nextRecurrenceDate(rule, '2026-01-31', '2026-01-31')).toBe('2026-02-28')
    // After the clamp, March is back on the 31st.
    expect(nextRecurrenceDate(rule, '2026-02-28', '2026-02-28')).toBe('2026-03-31')
    expect(nextRecurrenceDate(rule, '2026-03-31', '2026-03-31')).toBe('2026-04-30')
    expect(nextRecurrenceDate({ frequency: 'monthly', interval: 2, monthDay: 15 }, '2026-01-15', '2026-01-15')).toBe('2026-03-15')
  })

  it('handles leap days in yearly rules', () => {
    const rule = { frequency: 'yearly' as const, interval: 1, monthDay: 29 }
    expect(nextRecurrenceDate(rule, '2028-02-29', '2028-02-29')).toBe('2029-02-28')
    expect(nextRecurrenceDate(rule, '2031-02-28', '2031-02-28')).toBe('2032-02-29')
  })
})

describe('normalizeTaskRecurrence', () => {
  it('accepts valid rules and rejects junk', () => {
    expect(normalizeTaskRecurrence({ frequency: 'weekly', interval: 2 })).toEqual({ frequency: 'weekly', interval: 2 })
    expect(normalizeTaskRecurrence({ frequency: 'weekdays', interval: 5 })).toEqual({ frequency: 'weekdays', interval: 1 })
    expect(normalizeTaskRecurrence({ frequency: 'monthly', interval: 0, monthDay: 31 })).toEqual({ frequency: 'monthly', interval: 1, monthDay: 31 })
    expect(normalizeTaskRecurrence({ frequency: 'hourly', interval: 1 })).toBeUndefined()
    expect(normalizeTaskRecurrence(null)).toBeUndefined()
    expect(normalizeTaskRecurrence('weekly')).toBeUndefined()
  })

  it('reads drawer option values, taking the month day from the due date', () => {
    expect(recurrenceFromOption('weekly:2', '2026-10-09')).toEqual({ frequency: 'weekly', interval: 2 })
    expect(recurrenceFromOption('monthly:1', '2026-10-31')).toEqual({ frequency: 'monthly', interval: 1, monthDay: 31 })
  })
})

describe('buildNextOccurrence', () => {
  const now = new Date(2026, 9, 8, 10) // Thursday 2026-10-08

  it('creates a fresh copy due on the next date, carrying the rule', () => {
    const next = buildNextOccurrence(task({ dueDate: '2026-10-09', recurrence: { frequency: 'weekly', interval: 1 } }), now)
    expect(next).toMatchObject({
      title: '交周报',
      description: '每周五前发给老板',
      priority: 'high',
      tags: ['工作'],
      status: 'todo',
      dueDate: '2026-10-16',
      recurrence: { frequency: 'weekly', interval: 1 },
    })
    expect(next?.subtasks).toEqual([{ id: expect.any(String), title: '汇总数据', done: false }])
    expect(next?.subtasks[0]?.id).not.toBe('s1')
  })

  it('moves start/end dates and the reminder with the due date', () => {
    const reminderAt = new Date(2026, 9, 9, 9, 30).getTime()
    const next = buildNextOccurrence(task({
      dueDate: '2026-10-09',
      startDate: '2026-10-07',
      endDate: '2026-10-09',
      reminderAt,
      recurrence: { frequency: 'weekly', interval: 1 },
    }), now)
    expect(next).toMatchObject({ dueDate: '2026-10-16', startDate: '2026-10-14', endDate: '2026-10-16' })
    expect(next?.reminderAt).toBe(new Date(2026, 9, 16, 9, 30).getTime())
  })

  it('starts from today when the task had no due date', () => {
    const reminderAt = new Date(2026, 9, 1, 7, 0).getTime()
    const next = buildNextOccurrence(task({ reminderAt, recurrence: { frequency: 'daily', interval: 1 } }), now)
    expect(next).toMatchObject({ dueDate: '2026-10-09' })
    expect(next?.reminderAt).toBe(new Date(2026, 9, 9, 7, 0).getTime())
  })

  it('returns nothing for a task without a rule', () => {
    expect(buildNextOccurrence(task(), now)).toBeNull()
  })
})
