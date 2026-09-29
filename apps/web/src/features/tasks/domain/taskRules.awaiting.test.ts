import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../tasks.types'
import {
  getTaskWaitingDays,
  isTaskAwaitingOthers,
  isTaskDueForPoll,
  isTaskOpen,
  isTaskOverdue,
} from './taskRules'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(2026, 8, 16, 12, 0, 0).getTime()

const task = (patch: Partial<TaskItem>): TaskItem =>
  ({
    id: 't1',
    createdAt: NOW,
    updatedAt: NOW,
    title: 'Chase the LDC sample boxes',
    description: '',
    pinned: false,
    isToday: false,
    status: 'todo',
    priority: null,
    tags: [],
    subtasks: [],
    taskNoteBlocks: [],
    activityLogs: [],
    ...patch,
  }) as TaskItem

describe('awaiting statuses', () => {
  it('treats waiting and verify as open, not done', () => {
    expect(isTaskOpen(task({ status: 'waiting' }))).toBe(true)
    expect(isTaskOpen(task({ status: 'verify' }))).toBe(true)
    expect(isTaskOpen(task({ status: 'done' }))).toBe(false)
  })

  it('identifies only waiting and verify as awaiting someone else', () => {
    expect(isTaskAwaitingOthers(task({ status: 'waiting' }))).toBe(true)
    expect(isTaskAwaitingOthers(task({ status: 'verify' }))).toBe(true)
    expect(isTaskAwaitingOthers(task({ status: 'todo' }))).toBe(false)
    expect(isTaskAwaitingOthers(task({ status: 'doing' }))).toBe(false)
  })

  // The point of the whole status: a date passing while the ball is with someone
  // else is their delay, and reporting it as your overdue work is what makes a
  // list feel like an accusation.
  it('never reports a task as overdue while it is awaiting someone else', () => {
    const pastDue = { dueDate: '2026-09-01' }
    expect(isTaskOverdue(task({ ...pastDue, status: 'todo' }), NOW)).toBe(true)
    expect(isTaskOverdue(task({ ...pastDue, status: 'doing' }), NOW)).toBe(true)
    expect(isTaskOverdue(task({ ...pastDue, status: 'waiting' }), NOW)).toBe(false)
    expect(isTaskOverdue(task({ ...pastDue, status: 'verify' }), NOW)).toBe(false)
  })

  it('measures how long it has gone unanswered instead', () => {
    expect(getTaskWaitingDays(task({ status: 'waiting', waitingSince: NOW - 11 * DAY }), NOW)).toBe(11)
    expect(getTaskWaitingDays(task({ status: 'verify', waitingSince: NOW }), NOW)).toBe(0)
  })

  it('reports no waiting age for tasks that are not awaiting anyone', () => {
    expect(getTaskWaitingDays(task({ status: 'todo', waitingSince: NOW - 5 * DAY }), NOW)).toBeNull()
    expect(getTaskWaitingDays(task({ status: 'waiting' }), NOW)).toBeNull()
  })

  it('flags a task for chasing once its poll date arrives', () => {
    expect(isTaskDueForPoll(task({ status: 'waiting', nextPollAt: NOW - 1 }), NOW)).toBe(true)
    expect(isTaskDueForPoll(task({ status: 'waiting', nextPollAt: NOW + DAY }), NOW)).toBe(false)
    expect(isTaskDueForPoll(task({ status: 'todo', nextPollAt: NOW - DAY }), NOW)).toBe(false)
  })
})
