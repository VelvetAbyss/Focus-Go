// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TaskItem } from '../tasks.types'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

import TasksAnalyticsView from './TasksAnalyticsView'

const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: overrides.isToday ?? false,
  status: overrides.status ?? 'todo',
  priority: null,
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  taskNoteContentMd: '',
  taskNoteContentJson: null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? Date.parse('2026-03-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-03-01T08:00:00Z'),
})

describe('TasksAnalyticsView', () => {
  it('keeps the analytics panel scrollable and renders trend highlights', () => {
    const tasks = [
      createTask({
        id: 'task-1',
        createdAt: Date.parse('2026-03-01T08:00:00Z'),
        activityLogs: [{ id: 'a', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-03T08:00:00Z') }],
      }),
      createTask({
        id: 'task-2',
        createdAt: Date.parse('2026-03-04T08:00:00Z'),
        activityLogs: [{ id: 'b', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-06T08:00:00Z') }],
      }),
    ]

    const { container } = render(<TasksAnalyticsView tasks={tasks} />)

    expect(container.querySelector('.tasks-analytics')).not.toHaveClass('overflow-y-auto')
    expect(container.querySelector('.tasks-analytics__scroller')).toHaveClass('overflow-y-auto')
    expect(container.querySelector('.tasks-analytics__summary-card')?.className).not.toContain('shadow-')
    expect(container.querySelector('.tasks-analytics__trend-panel')?.className).not.toContain('shadow-')
    expect(screen.getByText('峰值')).toBeInTheDocument()
    expect(screen.getByText('平均')).toBeInTheDocument()
    expect(screen.getByText('总完成')).toBeInTheDocument()
  })
})
