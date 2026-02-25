// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { TaskItem } from './tasks.types'

const listMock = vi.fn()
const subscribeTasksChangedMock = vi.fn()
let tasksChangedHandler: (() => void) | null = null

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    list: (...args: unknown[]) => listMock(...args),
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    appendProgress: vi.fn(),
    clearAllTags: vi.fn(),
  },
}))

vi.mock('./taskSync', () => ({
  emitTasksChanged: vi.fn(),
  subscribeTasksChanged: (handler: () => void) => {
    tasksChangedHandler = handler
    subscribeTasksChangedMock(handler)
    return () => {
      tasksChangedHandler = null
    }
  },
}))

vi.mock('../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('./components/TaskCalendarWidget', () => ({
  default: () => <div data-testid="task-calendar-widget" />,
}))

vi.mock('./TaskDrawer', () => ({
  default: () => null,
}))

vi.mock('../../shared/ui/Dialog', () => ({
  default: () => null,
}))

vi.mock('../../shared/ui/Select', () => ({
  default: ({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) => (
    <select aria-label="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
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
  default: ({ task }: { task: TaskItem }) => <div>{task.title}</div>,
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
  status: 'todo',
  priority: null,
  dueDate: undefined,
  tags: [],
  subtasks: [],
  progressLogs: [],
  activityLogs: [],
  createdAt: 1,
  updatedAt: 1,
})

describe('TasksBoard sync', () => {
  beforeEach(() => {
    cleanup()
    listMock.mockReset()
    subscribeTasksChangedMock.mockReset()
    tasksChangedHandler = null
    window.localStorage.clear()
    window.localStorage.setItem('tasks_tags_select_v2_migrated', '1')
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
})
