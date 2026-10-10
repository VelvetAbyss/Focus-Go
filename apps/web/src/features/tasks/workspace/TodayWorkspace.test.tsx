// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from '../../../data/models/types'
import TodayWorkspace from './TodayWorkspace'
import type { WorkspaceActions } from './WorkspaceTask'

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ language: 'zh', t: (key: string, values?: Record<string, unknown>) => (values?.n !== undefined ? `${key} ${values.n}` : key) }),
}))

const NOW = new Date(2026, 9, 10, 10, 0).getTime()

const task = (index: number): TaskItem => ({
  id: `t${index}`,
  title: `第 ${index} 件`,
  description: '',
  pinned: false,
  isToday: true,
  status: 'todo',
  priority: null,
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
  createdAt: 1,
  updatedAt: 1,
})

const actions = {
  open: vi.fn(), focus: vi.fn(), move: vi.fn(), plan: vi.fn(), busy: () => false,
} as unknown as WorkspaceActions

const renderToday = (count: number) => {
  const tasks = Array.from({ length: count }, (_, index) => task(index + 1))
  return render(<TodayWorkspace tasks={tasks} allTasks={tasks} projects={[]} actions={actions} now={NOW} onBulkPlan={async () => true} />)
}

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('TodayWorkspace overload note', () => {
  it('stays quiet at seven planned tasks', () => {
    renderToday(7)
    expect(screen.queryByText(/tasks.flow.overload/)).not.toBeInTheDocument()
  })

  it('notes eight or more, and hides for the rest of the day once dismissed', () => {
    const view = renderToday(9)
    expect(screen.getByText('tasks.flow.overload 9')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tasks.flow.overloadDismiss' }))
    expect(screen.queryByText(/tasks.flow.overload 9/)).not.toBeInTheDocument()

    view.unmount()
    renderToday(9)
    expect(screen.queryByText(/tasks.flow.overload 9/)).not.toBeInTheDocument()
  })
})
