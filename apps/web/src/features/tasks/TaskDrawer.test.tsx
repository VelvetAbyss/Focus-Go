// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from './tasks.types'

const addMock = vi.fn()
const updateMock = vi.fn()
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
        'tasks.today.title': 'Today',
        'tasks.today.switchHint': 'Add this task to today',
        'tasks.onboarding.exit': 'Back',
        'tasks.drawer.createTask': 'Create task',
        'tasks.drawer.saveFailed': 'Save failed',
        'tasks.drawer.retryHint': 'Try again.',
        'tasks.drawer.subtasks': '子任务',
        'tasks.drawer.executionChecklist': '执行清单',
        'tasks.drawer.subtaskFilterAll': '全部',
        'tasks.drawer.subtaskFilterTodo': '未完成',
        'tasks.drawer.subtaskFilterDone': '已完成',
      }[key] ?? key),
  }),
}))

vi.mock('../../shared/ui/Dialog', () => ({
  default: ({
    open,
    children,
    panelClassName,
    contentClassName,
  }: {
    open: boolean
    children: React.ReactNode
    panelClassName?: string
    contentClassName?: string
  }) =>
    open ? (
      <div className={panelClassName} role="dialog">
        <div className={contentClassName}>{children}</div>
      </div>
    ) : null,
}))

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    add: (...args: unknown[]) => addMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
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

vi.mock('../premium/PremiumProvider', () => ({
  usePremiumGate: () => ({
    isPremium: false,
    canUse: () => ({ allowed: true }),
    openUpgradeModal: vi.fn(),
    guard: vi.fn(async (_key: unknown, action: () => void) => { action(); return true }),
  }),
}))

import TaskDrawer from './TaskDrawer'

const createdTask: TaskItem = {
  id: 'task-1',
  title: 'First task',
  description: '',
  pinned: false,
  isToday: false,
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
    updateMock.mockReset()
    pushMock.mockReset()
    onCreated.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
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

  it('uses theme-aware surfaces in detail mode', async () => {
    document.documentElement.dataset.theme = 'dark'

    render(
      <TaskDrawer
        open
        task={createdTask}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    await waitFor(() => {
      const panel = document.body.querySelector('[role="dialog"]')
      const topbar = document.body.querySelector('.task-detail-topbar')

      expect(panel).not.toBeNull()
      expect(topbar).not.toBeNull()
      expect((panel as HTMLElement).className).not.toContain('bg-white')
      expect((topbar as HTMLElement).className).not.toContain('bg-white')
    })
  })

  it('autosaves the latest note content after rapid edits', async () => {
    vi.useFakeTimers()
    updateMock.mockImplementation(async (task: TaskItem) => ({
      ...task,
      updatedAt: task.updatedAt + 1,
    }))

    render(
      <TaskDrawer
        open
        task={createdTask}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    const textarea = screen.getByLabelText('任务备注编辑器')
    fireEvent.change(textarea, { target: { value: 'first' } })
    fireEvent.change(textarea, { target: { value: 'second' } })
    fireEvent.change(textarea, { target: { value: 'final note body' } })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(179)
    })
    expect(updateMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      id: createdTask.id,
      taskNoteContentMd: 'final note body',
    })
  })

  it('rehydrates note content when reopening the same task', async () => {
    const { rerender } = render(
      <TaskDrawer
        open
        task={createdTask}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    const nextTask = {
      ...createdTask,
      taskNoteContentMd: 'persisted note',
      taskNoteContentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'persisted note' }] }],
      },
    }

    rerender(
      <TaskDrawer
        open={false}
        task={null}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    rerender(
      <TaskDrawer
        open
        task={nextTask}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('任务备注编辑器')).toHaveValue('persisted note')
  })

  it('defaults subtask filter to todo when opening a task', async () => {
    render(
      <TaskDrawer
        open
        task={{
          ...createdTask,
          subtasks: [
            { id: 'sub-1', title: 'Todo item', done: false },
            { id: 'sub-2', title: 'Done item', done: true },
          ],
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
        onCreated={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '未完成' })).toHaveClass('bg-[#3a3733]')
    expect(screen.getByDisplayValue('Todo item')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Done item')).not.toBeInTheDocument()
  })
})
