// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState, type ReactNode } from 'react'
import type { Habit, WidgetTodo } from '../../../data/models/types'

const createHabitMock = vi.fn()
const completeHabitMock = vi.fn()
const undoHabitMock = vi.fn()
const updateHabitMock = vi.fn()
const archiveHabitMock = vi.fn()
const restoreHabitMock = vi.fn()
const refreshHabitsMock = vi.fn(async () => undefined)
const toastPushMock = vi.fn()
const listMock = vi.fn()
const addMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()
let syncRefreshCallback: (() => void) | null = null
let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null

vi.mock('../../habits/hooks/useHabitTracker', () => ({
  useHabitTracker: () => ({
    activeHabits: [
      {
        id: 'habit-1',
        userId: 'local-user',
        title: 'Plan day rhythm',
        description: '',
        icon: '🎯',
        type: 'boolean',
        color: '#3a3733',
        archived: false,
        freezesAllowed: 0,
        sortOrder: 0,
        createdAt: 100,
        updatedAt: 200,
      } satisfies Habit,
    ],
    completedDatesByHabit: { 'habit-1': ['2026-03-19'] },
    createHabit: (...args: unknown[]) => createHabitMock(...args),
    completeHabit: (...args: unknown[]) => completeHabitMock(...args),
    undoHabit: (...args: unknown[]) => undoHabitMock(...args),
    updateHabit: (...args: unknown[]) => updateHabitMock(...args),
    archiveHabit: (...args: unknown[]) => archiveHabitMock(...args),
    restoreHabit: (...args: unknown[]) => restoreHabitMock(...args),
    refresh: () => refreshHabitsMock(),
  }),
}))

vi.mock('../../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: (...args: unknown[]) => toastPushMock(...args) }),
}))

vi.mock('../../habits/model/dateKey', () => ({
  todayDateKey: () => '2026-03-19',
}))

vi.mock('../../../data/repositories/widgetTodoRepo', () => ({
  widgetTodoRepo: {
    list: (...args: unknown[]) => listMock(...args),
    add: (...args: unknown[]) => addMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    resetDone: vi.fn(async () => []),
    remove: (...args: unknown[]) => removeMock(...args),
  },
}))

vi.mock('../../../data/sync/service', () => ({
  useSyncDataRefresh: (callback: () => void) => {
    syncRefreshCallback = callback
  },
}))

vi.mock('../model/widgetTodoRefresh', () => ({
  readWidgetTodoResetBucket: vi.fn(() => '2026-03-19'),
  shouldBootstrapResetWidgetTodos: vi.fn(() => false),
  shouldResetWidgetTodos: vi.fn(() => ({ shouldReset: false, currentBucket: '2026-03-19' })),
  writeWidgetTodoResetBucket: vi.fn(),
}))

vi.mock('../../../shared/ui/AnimatedScrollList', () => ({
  default: ({ items, renderItem }: { items: WidgetTodo[]; renderItem: (item: WidgetTodo) => ReactNode }) => (
    <div>{items.map((item) => <div key={item.id}>{renderItem(item)}</div>)}</div>
  ),
}))

vi.mock('../../../shared/ui/AnimatedPlanCheckbox', () => ({
  default: (props: Record<string, unknown>) => <input type="checkbox" {...props} />,
}))

vi.mock('../../tasks/components/TaskAddComposer', () => ({
  default: function TaskAddComposerMock({ placeholder, onSubmit }: { placeholder: string; onSubmit: (value: string) => Promise<boolean> }) {
    const [value, setValue] = useState('')
    return (
      <form
        onSubmit={async (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          await onSubmit(value)
          setValue('')
        }}
        >
          <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
        <button type="submit">Add</button>
      </form>
    )
  },
}))

vi.mock('../../../shared/ui/tabPressAnimation', () => ({
  triggerTabGroupSwitchAnimation: vi.fn(),
  triggerTabPressAnimation: vi.fn(),
}))

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

import WidgetTodosCard from './WidgetTodosCard'

describe('WidgetTodosCard', () => {
  beforeEach(() => {
    cleanup()
    createHabitMock.mockReset()
    completeHabitMock.mockReset()
    undoHabitMock.mockReset()
    updateHabitMock.mockReset()
    archiveHabitMock.mockReset()
    restoreHabitMock.mockReset()
    toastPushMock.mockReset()
    listMock.mockReset()
    addMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
    syncRefreshCallback = null
    listMock.mockResolvedValue([
      {
        id: 'todo-day-1',
        createdAt: 1,
        updatedAt: 2,
        scope: 'day',
        title: 'Plan day rhythm',
        priority: 'medium',
        done: true,
        linkedHabitId: 'habit-1',
      },
      {
        id: 'todo-week-1',
        createdAt: 3,
        updatedAt: 4,
        scope: 'week',
        title: 'Weekly review',
        priority: 'medium',
        done: false,
      },
      {
        id: 'todo-month-1',
        createdAt: 5,
        updatedAt: 6,
        scope: 'month',
        title: 'Monthly reset',
        priority: 'medium',
        done: false,
      },
    ])
    addMock.mockImplementation(async (payload: Partial<WidgetTodo>) => ({
      id: `added-${payload.scope ?? 'day'}`,
      createdAt: 7,
      updatedAt: 8,
      scope: payload.scope ?? 'day',
      title: payload.title ?? '',
      priority: payload.priority ?? 'medium',
      done: Boolean(payload.done),
      linkedHabitId: payload.linkedHabitId,
    }))
    updateMock.mockImplementation(async (item: WidgetTodo) => item)
    removeMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    dateNowSpy?.mockRestore()
    dateNowSpy = null
  })

  it('renders daily habits from the habit tracker state', async () => {
    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())
    expect(screen.getByText('Weekly review')).toBeInTheDocument()
    expect(screen.getByText('Monthly reset')).toBeInTheDocument()
    // Editorial chip renders done/total as zero-padded mono pair and keeps the
    // full sentence on aria-label for assistive tech.
    expect(screen.getByLabelText('1 / 1 completed')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
  })

  it('creates a new boolean habit from the daily composer', async () => {
    const user = userEvent.setup()
    createHabitMock.mockResolvedValue(undefined)

    render(<WidgetTodosCard />)

    await user.type(screen.getByPlaceholderText('Add a new habit...'), 'Read 10 pages')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(createHabitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Read 10 pages',
        type: 'boolean',
      }),
    )
    // The habit is the row; no stored copy is written next to it.
    expect(addMock).not.toHaveBeenCalled()
  })

  it('shows each daily habit once, even when stored copies of it were duplicated', async () => {
    listMock.mockResolvedValue([
      { id: 'copy-1', createdAt: 1, updatedAt: 2, scope: 'day', title: 'Plan day rhythm', priority: 'medium', done: false, linkedHabitId: 'habit-1' },
      { id: 'copy-2', createdAt: 3, updatedAt: 4, scope: 'day', title: 'Plan day rhythm', priority: 'medium', done: false, linkedHabitId: 'habit-1' },
    ])

    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())
    expect(screen.getAllByText('Plan day rhythm')).toHaveLength(1)
    expect(screen.getByLabelText('1 / 1 completed')).toBeInTheDocument()
  })

  it('never writes a copy of a habit, even before any copy has synced down', async () => {
    listMock.mockResolvedValue([])

    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(addMock).not.toHaveBeenCalled()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deleting a daily habit archives the habit and offers undo', async () => {
    const user = userEvent.setup()
    archiveHabitMock.mockResolvedValue(undefined)
    restoreHabitMock.mockResolvedValue(undefined)

    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())
    const row = screen.getByText('Plan day rhythm').closest('.widget-todos__row') as HTMLElement
    await user.click(row.querySelector('.widget-todos__delete') as HTMLElement)

    await waitFor(() => expect(archiveHabitMock).toHaveBeenCalledWith('habit-1'))
    expect(removeMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
    expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ actionLabel: expect.any(String) }))

    toastPushMock.mock.calls[0][0].onAction()
    expect(restoreHabitMock).toHaveBeenCalledWith('habit-1')
  })

  it('deletes a weekly item outright', async () => {
    const user = userEvent.setup()

    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Weekly review')).toBeInTheDocument())
    const row = screen.getByText('Weekly review').closest('.widget-todos__row') as HTMLElement
    await user.click(row.querySelector('.widget-todos__delete') as HTMLElement)

    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('todo-week-1'))
    expect(archiveHabitMock).not.toHaveBeenCalled()
  })

  it('reloads widget todos after a sync refresh event', async () => {
    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())

    listMock.mockResolvedValueOnce([
      {
        id: 'todo-day-1',
        createdAt: 1,
        updatedAt: 9,
        scope: 'day',
        title: 'Plan day rhythm',
        priority: 'medium',
        done: true,
        linkedHabitId: 'habit-1',
      },
      {
        id: 'todo-day-2',
        createdAt: 8,
        updatedAt: 10,
        scope: 'day',
        title: 'Synced item',
        priority: 'medium',
        done: false,
      },
    ])

    await syncRefreshCallback?.()

    await waitFor(() => expect(screen.getByText('Synced item')).toBeInTheDocument())
  })

  it('shows a closing reminder on weekly tab during the Friday closing window', async () => {
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-20T08:00:00').getTime())

    render(<WidgetTodosCard />)

    const weeklyTab = await screen.findByRole('tab', { name: /Weekly/ })
    expect(weeklyTab).toHaveAttribute('title', '1 unfinished item(s) before this period closes')
    expect(weeklyTab.querySelector('.period-alert__badge')).not.toBeNull()
  })
})
