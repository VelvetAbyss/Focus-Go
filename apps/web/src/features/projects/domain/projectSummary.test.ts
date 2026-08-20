import { describe, expect, it } from 'vitest'
import type { ProjectItem, TaskItem } from '../../../data/models/types'
import { deriveNextAction, deriveProjectHealth, deriveProjectProgress } from './projectSummary'

const project = (overrides: Partial<ProjectItem> = {}): ProjectItem => ({
  id: overrides.id ?? 'project-1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Project',
  description: '',
  goal: '',
  status: overrides.status ?? 'active',
  priority: overrides.priority ?? 'medium',
  health: overrides.health ?? 'on-track',
  progress: overrides.progress ?? 0,
  nextAction: overrides.nextAction ?? '',
  riskSummary: '',
  dueDate: overrides.dueDate,
})

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
  isBlocked: overrides.isBlocked,
  blockedByTaskIds: overrides.blockedByTaskIds,
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
})

describe('project summary domain', () => {
  it('derives progress from completed task ratio', () => {
    expect(deriveProjectProgress([
      task({ status: 'done' }),
      task({ id: 'task-2', status: 'todo' }),
      task({ id: 'task-3', status: 'doing' }),
    ])).toBe(33)
  })

  it('marks projects blocked when any task is blocked', () => {
    expect(deriveProjectHealth(project(), [task({ isBlocked: true })])).toBe('blocked')
    expect(deriveProjectHealth(project(), [task({ blockedByTaskIds: ['task-a'] })])).toBe('blocked')
  })

  it('marks projects at risk when active tasks are overdue', () => {
    const now = new Date(2026, 2, 12, 9).getTime()

    expect(deriveProjectHealth(project(), [task({ dueDate: '2026-03-11' })], now)).toBe('at-risk')
    expect(deriveProjectHealth(project(), [task({ dueDate: '2026-03-11', status: 'done' })], now)).toBe('on-track')
  })

  it('selects next action by task domain ranking', () => {
    const next = deriveNextAction(project(), [
      task({ id: 'blocked', title: 'Blocked', priority: 'high', isBlocked: true }),
      task({ id: 'medium', title: 'Medium sooner', priority: 'medium', dueDate: '2026-03-10' }),
      task({ id: 'high-later', title: 'High later', priority: 'high', dueDate: '2026-03-20' }),
      task({ id: 'high-sooner', title: 'High sooner', priority: 'high', dueDate: '2026-03-18' }),
    ])

    expect(next).toBe('High sooner')
  })
})
