import { describe, expect, it } from 'vitest'
import type { ProjectItem, TaskItem } from '../../../data/models/types'
import { buildTaskProgressSummary, getTaskProgressRange } from './taskProgressSummary'

const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: false,
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? null,
  projectId: overrides.projectId,
  tags: [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: [],
  taskNoteContentMd: '',
  taskNoteContentJson: null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? Date.parse('2026-05-01T08:00:00'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-05-01T08:00:00'),
})

const createProject = (overrides: Partial<ProjectItem> = {}): ProjectItem => ({
  id: overrides.id ?? 'project-1',
  title: overrides.title ?? 'Project',
  description: '',
  goal: '',
  status: overrides.status ?? 'active',
  priority: overrides.priority ?? 'medium',
  color: overrides.color ?? '#6B8C7A',
  health: overrides.health ?? 'on-track',
  progress: overrides.progress ?? 50,
  nextAction: '',
  riskSummary: '',
  createdAt: overrides.createdAt ?? Date.parse('2026-05-01T08:00:00'),
  updatedAt: overrides.updatedAt ?? Date.parse('2026-05-01T08:00:00'),
})

describe('task progress summary', () => {
  it('builds current natural week and month ranges from local time', () => {
    const now = new Date(2026, 4, 13, 12).getTime()

    const week = getTaskProgressRange(now, 'week')
    const month = getTaskProgressRange(now, 'month')

    expect(new Date(week.startAt).getDay()).toBe(1)
    expect(new Date(week.startAt).getDate()).toBe(11)
    expect(new Date(month.startAt).getDate()).toBe(1)
    expect(new Date(month.startAt).getMonth()).toBe(4)
  })

  it('groups completed tasks by project and puts orphan tasks under unassigned', () => {
    const now = new Date(2026, 4, 13, 12).getTime()
    const projects = [createProject({ id: 'project-1', title: 'Launch' })]
    const tasks = [
      createTask({
        id: 'task-project',
        title: 'Ship onboarding',
        projectId: 'project-1',
        activityLogs: [{ id: 'a', type: 'status', message: '状态变更为已完成', createdAt: new Date(2026, 4, 12, 9).getTime() }],
      }),
      createTask({
        id: 'task-orphan',
        title: 'Send report',
        activityLogs: [{ id: 'b', type: 'status', message: 'Status changed to Done', createdAt: new Date(2026, 4, 13, 9).getTime() }],
      }),
    ]

    const summary = buildTaskProgressSummary({ tasks, projects, now, period: 'week' })

    expect(summary.totals.projectCount).toBe(2)
    expect(summary.projects.map((project) => project.projectTitle)).toEqual(expect.arrayContaining(['Launch', '未归属']))
  })

  it('dedupes repeated task completions for report rows while retaining event counts', () => {
    const now = new Date(2026, 4, 13, 12).getTime()
    const tasks = [
      createTask({
        id: 'task-repeat',
        title: 'Repeatable',
        activityLogs: [
          { id: 'a', type: 'status', message: 'Status changed to Done', createdAt: new Date(2026, 4, 11, 9).getTime() },
          { id: 'b', type: 'status', message: '状态变更为进行中', createdAt: new Date(2026, 4, 12, 9).getTime() },
          { id: 'c', type: 'status', message: '状态变更为已完成', createdAt: new Date(2026, 4, 13, 9).getTime() },
        ],
      }),
    ]

    const summary = buildTaskProgressSummary({ tasks, projects: [], now, period: 'week' })

    expect(summary.totals.completedTaskCount).toBe(1)
    expect(summary.totals.completionEventCount).toBe(2)
    expect(summary.projects[0]?.tasks).toHaveLength(1)
    expect(summary.projects[0]?.tasks[0]?.completionEvents).toBe(2)
  })

  it('uses precise subtask activity logs for detailed progress', () => {
    const now = new Date(2026, 4, 13, 12).getTime()
    const tasks = [
      createTask({
        id: 'task-1',
        title: 'Build widget',
        subtasks: [
          { id: 'sub-1', title: 'Model', done: true },
          { id: 'sub-2', title: 'UI', done: false },
        ],
        activityLogs: [
          { id: 'a', type: 'status', message: '状态变更为已完成', createdAt: new Date(2026, 4, 13, 10).getTime() },
          {
            id: 's1',
            type: 'subtask',
            message: '子任务已完成',
            subtaskId: 'sub-1',
            subtaskTitle: 'Model',
            subtaskDone: true,
            createdAt: new Date(2026, 4, 13, 9).getTime(),
          },
        ],
      }),
    ]

    const summary = buildTaskProgressSummary({ tasks, projects: [], now, period: 'week', mode: 'detailed' })

    expect(summary.totals.completedSubtaskCount).toBe(1)
    expect(summary.projects[0]?.preciseSubtaskCount).toBe(1)
    expect(summary.projects[0]?.fallbackSubtaskCount).toBe(0)
    expect(summary.projects[0]?.tasks[0]?.subtasks[0]).toMatchObject({ id: 'sub-1', precise: true })
    expect(summary.reportText).toContain('未归属：完成 1 个任务')
  })

  it('falls back to current done subtasks for old completed tasks without precise subtask logs', () => {
    const now = new Date(2026, 4, 13, 12).getTime()
    const tasks = [
      createTask({
        id: 'task-old',
        title: 'Legacy completion',
        subtasks: [
          { id: 'sub-1', title: 'Existing done', done: true },
          { id: 'sub-2', title: 'Pending', done: false },
        ],
        activityLogs: [{ id: 'a', type: 'status', message: 'Status changed to Done', createdAt: new Date(2026, 4, 12, 9).getTime() }],
      }),
    ]

    const summary = buildTaskProgressSummary({ tasks, projects: [], now, period: 'week', mode: 'detailed' })

    expect(summary.totals.completedSubtaskCount).toBe(1)
    expect(summary.projects[0]?.preciseSubtaskCount).toBe(0)
    expect(summary.projects[0]?.fallbackSubtaskCount).toBe(1)
    expect(summary.projects[0]?.tasks[0]?.subtasks[0]).toMatchObject({ id: 'sub-1', precise: false })
  })
})
