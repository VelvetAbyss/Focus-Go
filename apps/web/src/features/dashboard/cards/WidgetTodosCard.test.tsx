// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Habit, WidgetTodo } from '../../../data/models/types'

const createHabitMock = vi.fn()
const completeHabitMock = vi.fn()
const undoHabitMock = vi.fn()
const listMock = vi.fn()
const addMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()

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
  }),
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
    listMock.mockReset()
    addMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
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
  })

  it('renders daily habits from the habit tracker state', async () => {
    render(<WidgetTodosCard />)

    await waitFor(() => expect(screen.getByText('Plan day rhythm')).toBeInTheDocument())
    expect(screen.getByText('Weekly review')).toBeInTheDocument()
    expect(screen.getByText('Monthly reset')).toBeInTheDocument()
    expect(screen.getByText('1 / 1 completed')).toBeInTheDocument()
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
    expect(addMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'day',
        title: 'Read 10 pages',
      }),
    )
  })
})
