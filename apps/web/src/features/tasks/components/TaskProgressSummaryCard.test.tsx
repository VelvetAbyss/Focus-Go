// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectItem, TaskItem } from '../../../data/models/types'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

const { default: TaskProgressSummaryCard } = await import('./TaskProgressSummaryCard')

const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: false,
  status: overrides.status ?? 'done',
  priority: null,
  projectId: overrides.projectId,
  tags: [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: [],
  taskNoteContentMd: '',
  taskNoteContentJson: null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? new Date(2026, 4, 11, 9).getTime(),
  updatedAt: overrides.updatedAt ?? new Date(2026, 4, 11, 9).getTime(),
})

const createProject = (overrides: Partial<ProjectItem> = {}): ProjectItem => ({
  id: overrides.id ?? 'project-1',
  title: overrides.title ?? 'Launch',
  description: '',
  goal: '',
  status: overrides.status ?? 'active',
  priority: overrides.priority ?? 'medium',
  color: overrides.color ?? '#6B8C7A',
  health: overrides.health ?? 'on-track',
  progress: overrides.progress ?? 80,
  nextAction: '',
  riskSummary: '',
  createdAt: new Date(2026, 4, 1, 9).getTime(),
  updatedAt: new Date(2026, 4, 1, 9).getTime(),
})

describe('TaskProgressSummaryCard', () => {
  it('switches between compact and detailed modes', async () => {
    const user = userEvent.setup()
    const task = createTask({
      title: 'Ship progress widget',
      projectId: 'project-1',
      subtasks: [{ id: 'sub-1', title: 'Write summary model', done: true }],
      activityLogs: [
        { id: 'a', type: 'status', message: '状态变更为已完成', createdAt: new Date(2026, 4, 12, 9).getTime() },
        {
          id: 's1',
          type: 'subtask',
          message: '子任务已完成',
          subtaskId: 'sub-1',
          subtaskTitle: 'Write summary model',
          subtaskDone: true,
          createdAt: new Date(2026, 4, 12, 8).getTime(),
        },
      ],
    })

    render(
      <div style={{ height: 620 }}>
        <TaskProgressSummaryCard
          tasks={[task]}
          projects={[createProject()]}
          now={new Date(2026, 4, 13, 12).getTime()}
        />
      </div>,
    )

    // Editorial layout no longer renders the summary sentence inline; the totals
    // are surfaced via the stats trio. Verify the task count surfaces (formatted
    // as two digits) and that subtask detail is hidden until detailed mode.
    // Multiple stat tiles (tasks / subtasks / projects) all show 01 — accept
    // any non-empty match rather than coupling to the exact stat composition.
    expect(screen.getAllByText('01').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Write summary model')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Detailed' }))
    expect(screen.getByText('Write summary model')).toBeInTheDocument()
  })
})
