// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement, ReactNode } from 'react'
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
        'tasks.status.waiting': 'Waiting',
        'tasks.status.verify': 'To verify',
        'tasks.status.dropped': 'Dropped',
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
        'tasks.board.allProjects': 'All',
        'tasks.board.sectionInbox': 'Inbox',
        'tasks.board.sectionOverdue': 'Overdue',
        'tasks.bulkDeleteTitle': 'Delete {{count}} tasks',
        'tasks.bulkDeleteConfirm': 'Delete the {{count}} selected tasks?',
        'tasks.deletedManyToast': 'Deleted {{count}} tasks',
        'tasks.tagFilterEmpty': 'No tags yet',
        'tasks.overdue.reschedule': 'Reschedule',
        'tasks.overdue.toToday': 'All to today',
        'tasks.overdue.toTomorrow': 'All to tomorrow',
        'tasks.overdue.clearDue': 'Remove all due dates',
        'tasks.overdue.rescheduledToast': 'Rescheduled {{count}} overdue tasks',
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

const pushMock = vi.fn()

vi.mock('../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: pushMock }),
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
  default: ({ open, title, children }: { open: boolean; title?: string; children?: ReactNode }) =>
    open ? <div role="dialog" aria-label={title}>{children}</div> : null,
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

const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

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
    pushMock.mockReset()
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

  it('asks before deleting a bulk selection, then deletes with an undo notice', async () => {
    const taskA = makeTask('task-1', 'First task')
    const taskB = makeTask('task-2', 'Second task')
    listMock.mockResolvedValue([taskA, taskB])
    removeMock.mockResolvedValue([])

    render(<TasksBoard asCard={false} />)
    await waitFor(() => expect(screen.getByText('Bulk edit')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Bulk edit'))
    fireEvent.click(screen.getByTestId('task-card-task-1'))
    fireEvent.click(screen.getByTestId('task-card-task-2'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete 2 tasks' })
    expect(removeMock).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(removeMock).toHaveBeenCalledTimes(2))
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Deleted 2 tasks', actionLabel: 'Undo' }))
  })

  it('filters by the tags tasks actually carry, including ones typed in quick-add', async () => {
    listMock.mockResolvedValueOnce([
      { ...makeTask('task-1', 'Ship samples'), tags: ['Lowes'] },
      { ...makeTask('task-2', 'Write weekly report'), tags: ['工作'] },
      makeTask('task-3', 'No tag task'),
    ])

    render(<TasksBoard asCard={false} />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByText('Select tag'))

    expect(await screen.findByRole('button', { name: '#工作' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '#Lowes' }))

    await waitFor(() => expect(screen.queryByText('Write weekly report')).not.toBeInTheDocument())
    expect(screen.getByText('Ship samples')).toBeInTheDocument()
    expect(screen.queryByText('No tag task')).not.toBeInTheDocument()
  })

  describe('overdue tasks in Today', () => {
    const dateKey = (offsetDays: number) => {
      const now = new Date()
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    const overdue = (id: string) => ({ ...makeTask(id, `Late ${id}`), dueDate: dateKey(-3) })

    it('keeps a few late tasks open, and remembers folding them', async () => {
      listMock.mockResolvedValueOnce([overdue('a'), overdue('b')])

      render(<TasksBoard asCard={false} topView="today" />)
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

      const toggle = screen.getByRole('button', { name: /Overdue/ })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByText('Late a')).toBeInTheDocument()

      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Late a')).not.toBeInTheDocument()
      expect(window.localStorage.getItem('tasks_today_overdue_collapsed_v1')).toBe('1')
    })

    it('folds a pile of late tasks so today’s own tasks lead, and moves them all to tomorrow', async () => {
      const late = ['a', 'b', 'c', 'd'].map(overdue)
      listMock.mockResolvedValue([...late, { ...makeTask('today', 'Planned for today'), isToday: true }])
      updateMock.mockImplementation(async (task: TaskItem) => task)

      render(<TasksBoard asCard={false} topView="today" />)
      await waitFor(() => expect(screen.getByText('Planned for today')).toBeInTheDocument())

      expect(screen.getByRole('button', { name: /Overdue/ })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText('Late a')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }))
      fireEvent.click(await screen.findByRole('button', { name: 'All to tomorrow' }))

      await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(4))
      for (const call of updateMock.mock.calls) {
        expect(call[0]).toMatchObject({ dueDate: dateKey(1), isToday: false })
      }
      expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Rescheduled 4 overdue tasks', actionLabel: 'Undo' }))
    })
  })

  describe('waiting, verify and dropped', () => {
    const daysFromToday = (offset: number) => {
      const now = new Date()
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    it('shows a tab for a rarer status only once something is in it', async () => {
      listMock.mockResolvedValueOnce([
        makeTask('task-1', 'Plain todo'),
        { ...makeTask('task-2', 'Chase Lowe’s'), status: 'waiting' as const },
      ])

      render(<TasksBoard asCard={false} />)
      await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

      expect(screen.getByRole('tab', { name: /Waiting/ })).toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /To verify/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('tab', { name: /Dropped/ })).not.toBeInTheDocument()
      expect(screen.queryByText('Chase Lowe’s')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: /Waiting/ }))
      expect(await screen.findByText('Chase Lowe’s')).toBeInTheDocument()
      expect(screen.queryByText('Plain todo')).not.toBeInTheDocument()
    })

    it('keeps dropped tasks out of 今日 even when due today', async () => {
      listMock.mockResolvedValueOnce([
        { ...makeTask('task-1', 'Let go'), status: 'dropped' as const, dueDate: daysFromToday(0), isToday: true },
        { ...makeTask('task-2', 'Still on'), dueDate: daysFromToday(0) },
      ])

      render(<TasksBoard asCard={false} topView="today" />)
      await waitFor(() => expect(screen.getByText('Still on')).toBeInTheDocument())
      expect(screen.queryByText('Let go')).not.toBeInTheDocument()
    })

    it('brings a waiting task to 今日 on its chase date without calling it overdue', async () => {
      listMock.mockResolvedValueOnce([
        { ...makeTask('task-1', 'Chase Mac'), status: 'waiting' as const, dueDate: daysFromToday(-3) },
        { ...makeTask('task-2', 'Late report'), dueDate: daysFromToday(-3) },
      ])

      render(<TasksBoard asCard={false} topView="today" />)
      await waitFor(() => expect(screen.getByText('Chase Mac')).toBeInTheDocument())

      const overdueHeader = screen.getByRole('button', { name: /Overdue/ })
      expect(overdueHeader).toHaveTextContent('1')
      const overdueGroup = document.getElementById('tasks-overdue-group')
      expect(overdueGroup).toHaveTextContent('Late report')
      expect(overdueGroup).not.toHaveTextContent('Chase Mac')
    })
  })
})
