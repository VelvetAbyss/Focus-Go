import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../tasks.types'
import { buildTaskAnalytics } from './taskAnalytics'

const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: overrides.pinned ?? false,
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? null,
  dueDate: overrides.dueDate,
  startDate: overrides.startDate,
  endDate: overrides.endDate,
  reminderAt: overrides.reminderAt,
  reminderFiredAt: overrides.reminderFiredAt,
  tags: overrides.tags ?? [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: overrides.taskNoteBlocks ?? [],
  taskNoteContentMd: overrides.taskNoteContentMd ?? '',
  taskNoteContentJson: overrides.taskNoteContentJson ?? null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? Date.parse('2026-03-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-03-01T08:00:00Z'),
})

describe('buildTaskAnalytics', () => {
  it('counts each transition into done as a separate completion event', () => {
    const tasks = [
      createTask({
        id: 'task-repeat',
        createdAt: Date.parse('2026-03-01T08:00:00Z'),
        activityLogs: [
          { id: 'a', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-02T08:00:00Z') },
          { id: 'b', type: 'status', message: 'Status changed to Todo', createdAt: Date.parse('2026-03-03T08:00:00Z') },
          { id: 'c', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-04T08:00:00Z') },
        ],
      }),
    ]

    const analytics = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-10T00:00:00Z'), granularity: 'day' })

    expect(analytics.summary.completions).toBe(2)
    expect(analytics.buckets.filter((bucket) => bucket.completions > 0).map((bucket) => bucket.completions)).toEqual([1, 1])
  })

  it('ignores non-done activity log entries when building completion totals', () => {
    const tasks = [
      createTask({
        id: 'task-mixed',
        createdAt: Date.parse('2026-03-01T08:00:00Z'),
        activityLogs: [
          { id: 'a', type: 'status', message: 'Status changed to Doing', createdAt: Date.parse('2026-03-02T08:00:00Z') },
          { id: 'b', type: 'details', message: 'Details updated', createdAt: Date.parse('2026-03-03T08:00:00Z') },
          { id: 'c', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-04T08:00:00Z') },
        ],
      }),
    ]

    const analytics = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-10T00:00:00Z'), granularity: 'day' })

    expect(analytics.summary.completions).toBe(1)
  })

  it('builds weekly and monthly buckets with the configured window lengths', () => {
    const tasks = [
      createTask({
        id: 'task-1',
        createdAt: Date.parse('2026-01-15T08:00:00Z'),
        activityLogs: [{ id: 'a', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-02-02T08:00:00Z') }],
      }),
      createTask({
        id: 'task-2',
        createdAt: Date.parse('2026-02-20T08:00:00Z'),
        activityLogs: [{ id: 'b', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-03T08:00:00Z') }],
      }),
    ]

    const weekly = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-13T12:00:00Z'), granularity: 'week' })
    const monthly = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-13T12:00:00Z'), granularity: 'month' })

    expect(weekly.buckets).toHaveLength(12)
    expect(monthly.buckets).toHaveLength(12)
    expect(weekly.summary.completions).toBe(2)
    expect(monthly.summary.completions).toBe(2)
  })

  it('returns zeroed summaries and no streak when there is no completion history', () => {
    const tasks = [
      createTask({
        id: 'task-empty',
        createdAt: Date.parse('2026-03-10T08:00:00Z'),
        activityLogs: [{ id: 'a', type: 'status', message: 'Status changed to Doing', createdAt: Date.parse('2026-03-11T08:00:00Z') }],
      }),
    ]

    const analytics = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-13T12:00:00Z'), granularity: 'week' })

    expect(analytics.summary.completions).toBe(0)
    expect(analytics.summary.completionRate).toBe(0)
    expect(analytics.summary.streakDays).toBe(0)
    expect(analytics.summary.averageCompletions).toBe(0)
  })

  it('includes subtask and deadline summaries', () => {
    const tasks = [
      createTask({
        id: 'task-open-high',
        priority: 'high',
        dueDate: '2026-03-14',
        subtasks: [
          { id: 'a', title: 'One', done: true },
          { id: 'b', title: 'Two', done: false },
        ],
      }),
      createTask({
        id: 'task-open-medium',
        status: 'doing',
        priority: 'medium',
        dueDate: '2026-03-11',
        subtasks: [
          { id: 'c', title: 'Three', done: true },
          { id: 'd', title: 'Four', done: false },
        ],
      }),
      createTask({
        id: 'task-done',
        status: 'done',
        priority: null,
        subtasks: [],
      }),
    ]

    const analytics = buildTaskAnalytics(tasks, { now: Date.parse('2026-03-12T12:00:00Z'), granularity: 'day' })

    expect(analytics.summary.totalTasks).toBe(3)
    expect(analytics.summary.completedTasks).toBe(1)
    expect(analytics.summary.activeTasks).toBe(2)
    expect(analytics.summary.subtasksTotal).toBe(4)
    expect(analytics.summary.subtasksCompleted).toBe(2)
    expect(analytics.summary.subtaskCompletionRate).toBe(50)
    expect(analytics.summary.overdueTasks).toBe(1)
    expect(analytics.summary.dueSoonTasks).toBe(1)
    expect(analytics.summary.statusCounts).toEqual({ todo: 1, doing: 1, done: 1 })
    expect(analytics.summary.priorityCounts).toEqual({ high: 1, medium: 1, low: 0, none: 1 })
  })
})
