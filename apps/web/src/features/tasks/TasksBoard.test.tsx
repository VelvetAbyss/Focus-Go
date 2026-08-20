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
        'tasks.deleteTitle': 'Delete task',
        'tasks.deleteConfirm': 'Delete "{{title}}"?',
        'tasks.status.todo': 'Todo',
        'tasks.status.doing': 'Doing',
        'tasks.status.done': 'Done',
        'tasks.today.badge': 'Focus the tasks that matter today',
        'tasks.today.emptyTitle': 'No tasks lined up for today',
        'tasks.today.emptyDescription': 'Put the tasks you actually want to finish today here.',
        'tasks.today.addPlaceholder': 'Add a task for today...',
        'tasks.drawer.project': 'Project',
        'tasks.drawer.projectUnassigned': 'Unassigned',
        'tasks.board.emptyTitle': 'No tasks yet',
        'tasks.board.emptyDescription': 'Create a task to get started.',
        'emptyState.tasks.title': 'No tasks yet',
        'emptyState.tasks.body': 'Add your first task above to get started',
        'emptyState.tasks.related': 'Tasks can belong to a Project →',
        'emptyState.tasks.filtered.title': 'No tasks match your filters',
        'dashboard.widget.tasks': 'Tasks',
        'modules.tasks.addPlaceholder': 'Add a new task...',
        'modules.tasks.add': 'Add',
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

vi.mock('../../shared/discovery/useDiscoveryHint', () => ({
  useDiscoveryHint: () => ({ activeHintId: null, dismiss: vi.fn() }),
}))

const listMock = vi.fn()
const addMock = vi.fn()
const projectListMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()
const updateStatusMock = vi.fn()
const subscribeTasksChangedMock = vi.fn()
let tasksChangedHandler: (() => void) | null = null

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    list: (...args: unknown[]) => listMock(...args),
    add: (...args: unknown[]) => addMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
    updateStatus: (...args: unknown[]) => updateStatusMock(...args),
    clearAllTags: vi.fn(),
  },
}))

vi.mock('../../data/repositories/projectsRepo', () => ({
  projectsRepo: {
    list: (...args: unknown[]) => projectListMock(...args),
  },
}))

vi.mock('../../data/sync/service', () => ({
  useSyncDataRefresh: vi.fn(),
}))

vi.mock('../auth/AuthGateContext', () => ({
  useAuthGate: () => ({
    isGated: false,
    requireAuth: (action: () => void) => action(),
  }),
}))

vi.mock('./taskSync', () => ({
  emitTasksChanged: vi.fn(),
  subscribeTasksChanged: (callback: () => void) => {
    tasksChangedHandler = callback
    return subscribeTasksChangedMock(callback)
  },
}))

vi.mock('./TaskDrawer', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="task-drawer">detail</div> : null),
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
})

describe('TasksBoard sync', () => {
  beforeEach(() => {
    cleanup()
    listMock.mockReset()
    addMock.mockReset()
    projectListMock.mockReset()
    projectListMock.mockResolvedValue([])
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

  it('adds a task into the current board after the create call resolves', async () => {
    const created = { ...makeTask('task-created', 'Created online task'), createdAt: 2, updatedAt: 2 }
    listMock.mockResolvedValueOnce([])
    addMock.mockResolvedValueOnce(created)

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByPlaceholderText('Add a new task...'), { target: { value: 'Created online task' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Created online task' })))
    expect(await screen.findByText('Created online task')).toBeInTheDocument()
  })

  it('creates a task with the selected composer project', async () => {
    const created = { ...makeTask('task-created', 'Project task'), projectId: 'project-1', createdAt: 2, updatedAt: 2 }
    projectListMock.mockResolvedValueOnce([
      {
        id: 'project-1',
        title: 'Lowes',
        description: '',
        goal: '',
        status: 'active',
        priority: 'high',
        health: 'on-track',
        progress: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    listMock.mockResolvedValueOnce([])
    addMock.mockResolvedValueOnce(created)

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(projectListMock).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: 'project-1' } })
    fireEvent.change(screen.getByPlaceholderText('Add a new task...'), { target: { value: 'Project task' } })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => expect(addMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Project task', projectId: 'project-1' })))
  })

  it('shows only today-marked tasks in today view', async () => {
    listMock.mockResolvedValueOnce([
      { ...makeTask('task-1', 'Today task'), isToday: true },
      makeTask('task-2', 'Backlog task'),
    ])

    render(<TasksBoard asCard={false} topView="today" />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Today task')).toBeInTheDocument()
    expect(screen.queryByText('Backlog task')).not.toBeInTheDocument()
  })

  it('filters project-scoped tasks by the active status tabs', async () => {
    projectListMock.mockResolvedValueOnce([
      {
        id: 'project-1',
        title: 'Lowes',
        description: '',
        goal: '',
        status: 'active',
        priority: 'high',
        health: 'on-track',
        progress: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    listMock.mockResolvedValueOnce([
      { ...makeTask('task-1', 'Todo project task'), projectId: 'project-1', status: 'todo' },
      { ...makeTask('task-2', 'Doing project task'), projectId: 'project-1', status: 'doing' },
      { ...makeTask('task-3', 'Done project task'), projectId: 'project-1', status: 'done' },
      { ...makeTask('task-4', 'Other project task'), projectId: 'project-2', status: 'todo' },
    ])

    render(<TasksBoard asCard={false} scope={{ kind: 'project', projectId: 'project-1' }} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Todo project task')).toBeInTheDocument()
    expect(screen.queryByText('Doing project task')).not.toBeInTheDocument()
    expect(screen.queryByText('Done project task')).not.toBeInTheDocument()
    expect(screen.queryByText('Other project task')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Doing/ }))
    expect(await screen.findByText('Doing project task')).toBeInTheDocument()
    expect(screen.queryByText('Todo project task')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Done/ }))
    expect(await screen.findByText('Done project task')).toBeInTheDocument()
    expect(screen.queryByText('Doing project task')).not.toBeInTheDocument()
  })

  it('filters the full tasks board by a single selected project and keeps counts scoped to the active status', async () => {
    projectListMock.mockResolvedValueOnce([
      {
        id: 'project-1',
        title: 'Lowes',
        description: '',
        goal: '',
        status: 'active',
        priority: 'high',
        health: 'on-track',
        progress: 0,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'project-2',
        title: 'Costco',
        description: '',
        goal: '',
        status: 'active',
        priority: 'medium',
        health: 'on-track',
        progress: 0,
        createdAt: 1,
        updatedAt: 1,
      },
    ])
    listMock.mockResolvedValueOnce([
      { ...makeTask('task-1', 'Lowes doing task'), projectId: 'project-1', status: 'doing' },
      { ...makeTask('task-2', 'Lowes todo task'), projectId: 'project-1', status: 'todo' },
      { ...makeTask('task-3', 'Costco doing task'), projectId: 'project-2', status: 'doing' },
    ])

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('tab', { name: /Doing/ }))

    expect(await screen.findByText('Lowes doing task')).toBeInTheDocument()
    expect(screen.getByText('Costco doing task')).toBeInTheDocument()
    expect(screen.queryByText('Lowes todo task')).not.toBeInTheDocument()
    expect(screen.getByText('All').parentElement).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /Lowes1/ })).toHaveTextContent('1')

    fireEvent.click(screen.getByRole('button', { name: /Lowes1/ }))
    expect(await screen.findByText('Lowes doing task')).toBeInTheDocument()
    expect(screen.queryByText('Costco doing task')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Costco1/ }))
    expect(await screen.findByText('Costco doing task')).toBeInTheDocument()
    expect(screen.queryByText('Lowes doing task')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('All'))
    expect(await screen.findByText('Lowes doing task')).toBeInTheDocument()
    expect(screen.getByText('Costco doing task')).toBeInTheDocument()
  })

  it('keeps dashboard card layout separate from the plain tasks page layout', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    const { container } = render(<TasksBoard />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(container.querySelector('.tasks-fg')).toBeInTheDocument()
    expect(container.querySelector('.tasks-fg--plain')).not.toBeInTheDocument()
  })

  it('hides tag and sort controls in the dashboard card layout', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    render(<TasksBoard />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Select tag')).not.toBeInTheDocument()
    expect(screen.queryByText('Priority')).not.toBeInTheDocument()
  })

  it('keeps tag and sort controls on the full tasks page', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Select tag')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
  })

  it('keeps the plain tasks page surface from clipping shadows', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task')])

    const { container } = render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    const surface = container.querySelector('.tasks-board-surface')

    expect(surface).toBeInTheDocument()
    expect(surface?.className).not.toContain('overflow-hidden')
  })

  it('top-aligns card grid items so one hovered card does not stretch the whole row', async () => {
    listMock.mockResolvedValueOnce([makeTask('task-1', 'First task'), makeTask('task-2', 'Second task')])

    const { container } = render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    const grid = container.querySelector('.tasks-fg__card-grid')

    expect(grid).toBeInTheDocument()
    expect(grid?.className).toContain('items-start')
  })

  it('shows the empty state and keeps the composer available when there are no tasks', async () => {
    listMock.mockResolvedValueOnce([])

    render(<TasksBoard asCard={false} />)

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first task above to get started')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a new task...')).toBeInTheDocument()
    expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument()
  })
})
