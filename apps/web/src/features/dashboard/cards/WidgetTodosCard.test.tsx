// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { WidgetTodo } from '../../../data/models/types'

const listMock = vi.fn()
const resetDoneMock = vi.fn()
const addMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()
const pushToastMock = vi.fn()

vi.mock('../../../data/repositories/widgetTodoRepo', () => ({
  widgetTodoRepo: {
    list: (...args: unknown[]) => listMock(...args),
    resetDone: (...args: unknown[]) => resetDoneMock(...args),
    add: (...args: unknown[]) => addMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    remove: (...args: unknown[]) => removeMock(...args),
  },
}))

vi.mock('../../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: pushToastMock }),
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

import WidgetTodosCard from './WidgetTodosCard'

const makeTodo = (overrides: Partial<WidgetTodo> = {}): WidgetTodo => ({
  id: 'todo-1',
  createdAt: 100,
  updatedAt: 200,
  scope: 'day',
  title: 'Plan day rhythm',
  priority: 'medium',
  done: true,
  ...overrides,
})

describe('WidgetTodosCard', () => {
  beforeEach(() => {
    cleanup()
    listMock.mockReset()
    resetDoneMock.mockReset()
    addMock.mockReset()
    updateMock.mockReset()
    removeMock.mockReset()
    pushToastMock.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('catches up overdue daily resets on load without changing timestamps', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 2, 12, 9, 0, 0).getTime())
    window.localStorage.setItem('focusgo.widgetTodos.reset.day', '2026-03-10')

    listMock.mockResolvedValueOnce([makeTodo()])
    resetDoneMock.mockResolvedValueOnce([makeTodo({ done: false })])

    render(<WidgetTodosCard />)

    await waitFor(() => expect(resetDoneMock).toHaveBeenCalledWith('day'))
    await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked())
    expect(window.localStorage.getItem('focusgo.widgetTodos.reset.day')).toBe('2026-03-12')
    expect(pushToastMock).not.toHaveBeenCalled()
    nowSpy.mockRestore()
  })
})
