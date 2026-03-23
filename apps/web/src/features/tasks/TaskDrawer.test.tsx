// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from './tasks.types'

const addMock = vi.fn()
const pushMock = vi.fn()
const onCreated = vi.fn()

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'tasks.drawer.startWithOneTask': 'Start with one task',
        'tasks.onboarding.title': 'Create your first task',
        'tasks.drawer.onboardingHint': 'Hint',
        'tasks.drawer.title': 'Task title',
        'tasks.drawer.summary': 'Task summary',
        'tasks.drawer.summaryPlaceholder': 'Summary',
        'tasks.onboarding.exit': 'Back',
        'tasks.drawer.createTask': 'Create task',
        'tasks.drawer.saveFailed': 'Save failed',
        'tasks.drawer.retryHint': 'Try again.',
      }[key] ?? key),
  }),
}))

vi.mock('../../shared/ui/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}))

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    add: (...args: unknown[]) => addMock(...args),
    update: vi.fn(),
    remove: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

vi.mock('./taskSync', () => ({
  emitTasksChanged: vi.fn(),
}))

import TaskDrawer from './TaskDrawer'

const createdTask: TaskItem = {
  id: 'task-1',
  title: 'First task',
  description: '',
  pinned: false,
  status: 'todo',
  priority: null,
  dueDate: undefined,
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
  createdAt: 1,
  updatedAt: 1,
}

describe('TaskDrawer onboarding mode', () => {
  beforeEach(() => {
    addMock.mockReset()
    pushMock.mockReset()
    onCreated.mockReset()
  })

  it('blocks empty submit and creates a task', async () => {
    addMock.mockResolvedValue(createdTask)

    render(
      <TaskDrawer
        open
        task={null}
        mode="onboarding"
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={onCreated}
      />,
    )

    expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Task title'), { target: { value: 'First task' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(addMock).toHaveBeenCalledTimes(1))
    expect(onCreated).toHaveBeenCalledWith(createdTask)
  })
})
