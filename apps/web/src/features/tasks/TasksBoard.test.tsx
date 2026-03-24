// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { TaskItem } from './tasks.types'

const { mockT } = vi.hoisted(() => {
  return {
    mockT: (key: string, values?: Record<string, string | number>) => {
      const msgs: Record<string, string> = {
        'tasks.unpinned': 'Task unpinned',
        'tasks.undo': 'Undo',
        'tasks.clearFilters': 'Clear filters',
        'tasks.sortBy': 'Sort by',
        'tasks.sort.priority': 'Priority',
        'tasks.sort.created': 'Created',
        'tasks.taskCount': '{{count}} task(s)',
        'tasks.selectAll': 'Select all visible tasks',
        'tasks.selected': '{{count}} selected',
        'tasks.bulkTag': 'Bulk tag selector',
        'tasks.selectTag': 'Select tag',
        'tasks.applyTag': 'Apply tag to selected tasks',
        'tasks.markDone': 'Mark selected tasks done',
        'tasks.delete': 'Delete',
        'tasks.cancel': 'Cancel',
        'tasks.bulkEdit': 'Bulk edit',
        'tasks.kanban': 'Kanban',
        'tasks.calendar': 'Calendar',
        'tasks.deleteTitle': 'Delete task',
        'tasks.deleteConfirm': 'Delete "{{title}}"?',
        'tasks.status.todo': 'Todo',
        'tasks.status.doing': 'Doing',
        'tasks.status.done': 'Done',
        'dashboard.widget.tasks': 'Tasks',
      }
      const msg = msgs[key]
      if (!msg) return key
      if (!values) return msg
      return msg.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => String(values[k] ?? `{{${k}}}`))
    }
  }
})

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: mockT, language: 'en' as const }),
}))

vi.mock('../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const listMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()
const updateStatusMock = vi.fn()
const subscribeTasksChangedMock = vi.fn()
let tasksChangedHandler: (() => void) | null = null

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    list: (...args: unknown[]) => listMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
    updateStatus: (...args: unknown[]) => updateStatusMock(...args),
    clearAllTags: vi.fn(),
    add: vi.fn(),
  },
}))

vi.mock('./taskSync', () => ({
  emitTasksChanged: vi.fn(),
  subscribeTasksChanged: (callback: () => void) => {
    tasksChangedHandler = callback
    return subscribeTasksChangedMock(callback)
  },
}))

vi.mock('./components/TaskCalendarWidget', () => ({
  default: () => <div data-testid="task-calendar-widget" />,
}))

vi.mock('./TaskDrawer', () => ({
  default: ({ open, mode }: { open: boolean; mode?: string }) => (open ? <div data-testid="task-drawer">{mode ?? 'normal'}</div> : null),
}))

vi.mock('../../shared/ui/Dialog', () => ({
  default: () => null,
}))

vi.mock('../../shared/ui/AppNumber', () => ({
  AppNumber: ({ value }: { value: number }) => <span>{value}</span>,
}))

vi.mock('../../shared/ui/AnimatedScrollList', () => ({
  default: ({ items, renderItem, emptyState }: { items: TaskItem[]; renderItem: (task: TaskItem) => ReactNode; emptyState: ReactNode }) => (
    <div>{items.length ? items.map((item) => <div key={item.id}>{renderItem(item)}</div>) : emptyState}</div>
  ),
}))

vi.mock('./components/TaskCard', () => ({
  default: ({ task, onClick, selected }: { task: TaskItem; onClick?: (task: TaskItem) => void; selected?: boolean }) => (
    <button type="button" data-testid={`task-card-${task.id}`} data-selected={selected ? 'yes' : 'no'} onClick={() => onClick?.(task)}>
      {task.title}
    </button>
  ),
}))

vi.mock('../../shared/ui/tabPressAnimation', () => ({
  triggerTabGroupSwitchAnimation: vi.fn(),
  triggerTabPressAnimation: vi.fn(),
}))

import TasksBoard from './TasksBoard'

const makeTask = (id: string, title: string): TaskItem => ({
  id,
  title,
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
})

describe('TasksBoard sync', () => {
  beforeEach(() => {
    cleanup()
    listMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
    updateStatusMock.mockReset()
    subscribeTasksChangedMock.mockReset()
    subscribeTasksChangedMock.mockReturnValue(() => {})
    tasksChangedHandler = null
    window.localStorage.clear()
    window.localStorage.setItem('tasks_tags_select_v2_migrated', '1')
  })

  it('supports bulk done on currently visible tasks and renders tag selector', async () => {
    const taskA = { ...makeTask('task-1', 'First task'), tags: ['work'] }
    const taskB = { ...makeTask('task-2', 'Second task'), tags: ['work'] }
    listMock.mockResolvedValueOnce([taskA, taskB])
    updateStatusMock.mockImplementation(async (id: string, status: TaskItem['status']) => ({ ...(id === 'task-1' ? taskA : taskB), status }))

    render(<TasksBoard asCard={false} />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

    await waitFor(() => expect(screen.getByText('Bulk edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bulk edit'))
    await waitFor(() => expect(screen.getByLabelText('Select all visible tasks')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('task-card-task-1'))
    fireEvent.click(screen.getByTestId('task-card-task-2'))

    expect(screen.getByLabelText('Bulk tag selector')).toBeInTheDocument()

    screen.getByLabelText('Mark selected tasks done').click()
    await waitFor(() => expect(updateStatusMock).toHaveBeenCalledTimes(2))
  })

  afterEach(() => {
    cleanup()
  })

  it('refreshes tasks when tasks-changed event is emitted', async () => {
    listMock
      .mockResolvedValueOnce([makeTask('task-1', 'First task')])
      .mockResolvedValueOnce([makeTask('task-1', 'First task'), makeTask('task-2', 'Synced task')])

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('First task')).toBeInTheDocument()

    expect(tasksChangedHandler).not.toBeNull()
    tasksChangedHandler?.()

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Synced task')).toBeInTheDocument()
  })

  it('keeps dashboard card layout separate from the plain tasks page layout', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    const { container } = render(<TasksBoard />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(container.querySelector('.tasks-fg')).toBeInTheDocument()
    expect(container.querySelector('.tasks-fg--plain')).not.toBeInTheDocument()
  })

  it('keeps the plain tasks page surface from clipping shadows', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    const { container } = render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    const surface = container.querySelector('.tasks-board-surface')

    expect(surface).toBeInTheDocument()
    expect(surface?.className).not.toContain('overflow-hidden')
  })

  it('opens onboarding drawer and hides composer in onboarding mode', async () => {
    listMock.mockResolvedValueOnce([])

    render(<TasksBoard asCard={false} onboardingMode />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('task-drawer')).toHaveTextContent('onboarding')
    expect(screen.queryByPlaceholderText('Add a new task...')).not.toBeInTheDocument()
  })
})
