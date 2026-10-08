import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../tasks.types'
import {
  getTaskCompletion,
  getTaskDateRange,
  getTaskWaitingDays,
  isTaskClosed,
  isTaskFollowUpDue,
  taskCoversDate,
  isTaskBlocked,
  isTaskInToday,
  isTaskOverdue,
  rankNextActionTask,
} from './taskRules'

const task = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: false,
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? null,
  dueDate: overrides.dueDate,
  startDate: overrides.startDate,
  endDate: overrides.endDate,
  blockedByTaskIds: overrides.blockedByTaskIds,
  isBlocked: overrides.isBlocked,
  waitingSince: overrides.waitingSince,
  tags: [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: [],
  activityLogs: [],
})

describe('task domain rules', () => {
  it('treats overdue as a local date-only rule and excludes done tasks', () => {
    const now = new Date(2026, 2, 12, 8).getTime()

    expect(isTaskOverdue(task({ dueDate: '2026-03-11' }), now)).toBe(true)
    expect(isTaskOverdue(task({ dueDate: '2026-03-12' }), now)).toBe(false)
    expect(isTaskOverdue(task({ dueDate: '2026-03-11', status: 'done' }), now)).toBe(false)
  })

  it('normalizes task date ranges without changing existing display behavior', () => {
    expect(getTaskDateRange(task({ dueDate: '2026-03-12' }))).toEqual({ startDate: '2026-03-12', endDate: '2026-03-12' })
    expect(getTaskDateRange(task({ startDate: '2026-03-10', endDate: '2026-03-12' }))).toEqual({ startDate: '2026-03-10', endDate: '2026-03-12' })
    expect(getTaskDateRange(task({ startDate: '2026-03-12', endDate: '2026-03-10' }))).toEqual({ startDate: '2026-03-10', endDate: '2026-03-12' })
  })

  it('puts marked, due-today and open overdue tasks in 今日', () => {
    const now = new Date(2026, 2, 12, 8).getTime()
    expect(isTaskInToday({ ...task(), isToday: true }, now)).toBe(true)
    expect(isTaskInToday(task({ dueDate: '2026-03-12' }), now)).toBe(true)
    expect(isTaskInToday(task({ dueDate: '2026-03-12', status: 'done' }), now)).toBe(true)
    expect(isTaskInToday(task({ dueDate: '2026-03-10' }), now)).toBe(true)
    expect(isTaskInToday(task({ dueDate: '2026-03-10', status: 'done' }), now)).toBe(false)
    expect(isTaskInToday(task({ dueDate: '2026-03-13' }), now)).toBe(false)
    expect(isTaskInToday(task(), now)).toBe(false)
  })

  it('never calls a waiting task overdue; its date is when to follow up', () => {
    const now = new Date(2026, 2, 12, 8).getTime()
    const waitingLate = task({ dueDate: '2026-03-08', status: 'waiting' })
    expect(isTaskOverdue(waitingLate, now)).toBe(false)
    expect(isTaskFollowUpDue(waitingLate, now)).toBe(true)
    expect(isTaskFollowUpDue(task({ dueDate: '2026-03-12', status: 'waiting' }), now)).toBe(true)
    expect(isTaskFollowUpDue(task({ dueDate: '2026-03-13', status: 'waiting' }), now)).toBe(false)
    expect(isTaskFollowUpDue(task({ dueDate: '2026-03-08' }), now)).toBe(false)
    // …and it comes to 今日 when it's time to chase.
    expect(isTaskInToday(waitingLate, now)).toBe(true)
    expect(isTaskInToday(task({ dueDate: '2026-03-13', status: 'waiting' }), now)).toBe(false)
  })

  it('treats dropped as closed and keeps it out of 今日', () => {
    const now = new Date(2026, 2, 12, 8).getTime()
    expect(isTaskClosed(task({ status: 'dropped' }))).toBe(true)
    expect(isTaskClosed(task({ status: 'verify' }))).toBe(false)
    expect(isTaskOverdue(task({ dueDate: '2026-03-01', status: 'dropped' }), now)).toBe(false)
    expect(isTaskInToday({ ...task({ status: 'dropped', dueDate: '2026-03-12' }), isToday: true }, now)).toBe(false)
    // A task to verify is still yours: it can be overdue.
    expect(isTaskOverdue(task({ dueDate: '2026-03-11', status: 'verify' }), now)).toBe(true)
  })

  it('counts whole days spent waiting', () => {
    const now = new Date(2026, 2, 12, 8).getTime()
    expect(getTaskWaitingDays(task({ status: 'waiting', waitingSince: new Date(2026, 2, 6, 23).getTime() }), now)).toBe(6)
    expect(getTaskWaitingDays(task({ status: 'waiting', waitingSince: new Date(2026, 2, 12, 7).getTime() }), now)).toBe(0)
    expect(getTaskWaitingDays(task({ status: 'todo', waitingSince: 1 }), now)).toBeNull()
  })

  it('spans a start date to a later due date when no end date is set', () => {
    expect(getTaskDateRange(task({ startDate: '2026-03-10', dueDate: '2026-03-13' }))).toEqual({ startDate: '2026-03-10', endDate: '2026-03-13' })
    expect(getTaskDateRange(task({ startDate: '2026-03-10', dueDate: '2026-03-08' }))).toEqual({ startDate: '2026-03-10', endDate: '2026-03-10' })
    expect(taskCoversDate(task({ startDate: '2026-03-10', dueDate: '2026-03-13' }), '2026-03-13')).toBe(true)
  })

  it('computes subtask completion', () => {
    expect(getTaskCompletion(task())).toBeNull()
    expect(getTaskCompletion(task({
      subtasks: [
        { id: 'a', title: 'A', done: true },
        { id: 'b', title: 'B', done: false },
      ],
    }))).toEqual({ completed: 1, total: 2 })
  })

  it('recognizes both explicit blocked state and blocker ids', () => {
    expect(isTaskBlocked(task({ isBlocked: true }))).toBe(true)
    expect(isTaskBlocked(task({ blockedByTaskIds: ['task-a'] }))).toBe(true)
    expect(isTaskBlocked(task())).toBe(false)
  })

  it('ranks next action candidates by priority, due date, then age', () => {
    const highLater = task({ id: 'high-later', priority: 'high', dueDate: '2026-03-20', createdAt: 3 })
    const highSooner = task({ id: 'high-sooner', priority: 'high', dueDate: '2026-03-18', createdAt: 4 })
    const mediumSooner = task({ id: 'medium-sooner', priority: 'medium', dueDate: '2026-03-10', createdAt: 1 })

    expect([mediumSooner, highLater, highSooner].sort(rankNextActionTask).map((item) => item.id)).toEqual([
      'high-sooner',
      'high-later',
      'medium-sooner',
    ])
  })
})
