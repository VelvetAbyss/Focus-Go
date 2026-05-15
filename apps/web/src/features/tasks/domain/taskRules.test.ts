import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../tasks.types'
import {
  getTaskCompletion,
  getTaskDateRange,
  isTaskBlocked,
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
