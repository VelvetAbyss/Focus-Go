// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from './tasks.types'

const updateMock = vi.fn()
const pushMock = vi.fn()

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
        'tasks.drawer.saveFailed': 'Save failed',
        'tasks.drawer.saveFailedHint': 'Try again.',
        'tasks.drawer.retryHint': 'Try again.',
        'tasks.drawer.invalidDateRange': 'Invalid date range',
        'tasks.drawer.endDateError': 'End date must be after start date',
        'tasks.drawer.updateFailed': 'Update failed',
        'tasks.status.saved': 'Saved',
        'tasks.action.start': 'Start',
        'tasks.action.done': 'Done',
        'tasks.status.reopen': 'Reopen',
        'tasks.drawer.created': 'Created',
        'tasks.drawer.updated': 'Updated',
        'tasks.drawer.pinned': 'Pinned',
        'tasks.drawer.none': 'None',
        'tasks.drawer.status': 'Status',
        'tasks.drawer.priority': 'Priority',
        'tasks.drawer.reminderTimestamp': 'Reminder timestamp',
        'tasks.drawer.details': 'Details',
        'tasks.drawer.coreProperties': 'Core properties',
        'tasks.drawer.dueDate': 'Due date',
        'tasks.drawer.setDate': 'Set date',
        'tasks.drawer.reminder': 'Reminder',
        'tasks.drawer.setReminder': 'Set reminder',
        'tasks.drawer.dateRange': 'Date range',
        'tasks.drawer.tags': 'Tags',
        'tasks.drawer.tagContext': 'Tag context',
        'tasks.drawer.newTag': 'New tag',
        'tasks.drawer.customTag': 'Custom tag',
        'tasks.drawer.add': 'Add',
        'tasks.drawer.noTags': 'No tags',
        'tasks.drawer.activity': 'Activity',
        'tasks.drawer.systemTimeline': 'System timeline',
        'tasks.drawer.noActivity': 'No activity',
        'tasks.drawer.resizeColumns': 'Resize columns',
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
    updateMock.mockReset()
    pushMock.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
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
      />,
    )

    rerender(
      <TaskDrawer
        open
        task={nextTask}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
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
      />,
    )

    expect(screen.getByRole('button', { name: '未完成' })).toHaveClass('bg-[#3a3733]')
    expect(screen.getByDisplayValue('Todo item')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Done item')).not.toBeInTheDocument()
  })

  it('keeps task detail columns constrained when subtask filters change', async () => {
    render(
      <TaskDrawer
        open
        task={{
          ...createdTask,
          subtasks: [
            { id: 'sub-1', title: 'Todo item', done: false },
            { id: 'sub-2', title: 'Done item with a long title that should stay inside the right pane', done: true },
          ],
        }}
        onClose={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    const layout = document.body.querySelector('.task-detail-layout') as HTMLElement
    expect(layout.style.gridTemplateColumns).toContain('minmax(0')

    fireEvent.click(screen.getByRole('button', { name: '已完成' }))
    expect(layout.style.gridTemplateColumns).toContain('minmax(0')
    expect(document.body.querySelector('.task-detail-pane--right')).toHaveClass('min-w-0')
    expect(document.body.querySelector('.task-detail-aside')).toHaveClass('min-w-0')
  })
})
