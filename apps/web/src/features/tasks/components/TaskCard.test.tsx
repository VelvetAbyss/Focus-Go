// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

import TaskCard from './TaskCard'
import type { TaskItem } from '../tasks.types'

const task: TaskItem = {
  id: 'task-1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Write hover animation',
  description: '',
  pinned: false,
  isToday: false,
  status: 'todo',
  priority: 'high',
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
}

describe('TaskCard', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('uses animated reveal classes for hover content', () => {
    render(
      <TaskCard
        task={task}
        onSelect={vi.fn()}
      />,
    )

    const card = screen.getByText('Write hover animation').closest('.task-card-shell')
    const reveal = screen.getByTestId('task-card-actions')

    expect(card).not.toBeNull()
    expect(card?.className).toContain('task-card-shell')
    expect(reveal.className).toContain('task-card__actions')
    expect(reveal.className).toContain('grid-rows-[0fr]')

    fireEvent.mouseEnter(card!)

    expect(reveal.className).toContain('grid-rows-[1fr]')
    expect(reveal.className).toContain('translate-y-0')
  })

  it('does not render a progress entry action', () => {
    render(<TaskCard task={task} onSelect={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('blurs the card when opening a task so focus reveal state does not stick', () => {
    const onSelect = vi.fn()
    render(<TaskCard task={task} onSelect={onSelect} />)

    const card = screen.getByRole('button', { name: /write hover animation/i })
    card.focus()
    expect(card).toHaveFocus()

    fireEvent.click(card)

    expect(onSelect).toHaveBeenCalledWith(task)
    expect(card).not.toHaveFocus()
  })

  it('keeps the today action active class inside dashboard task cards', () => {
    const todayTask = { ...task, isToday: true }
    const { container } = render(
      <div className="dashboard-widget-card--tasks">
        <TaskCard task={todayTask} onSelect={vi.fn()} onToggleToday={vi.fn()} />
      </div>,
    )

    const button = container.querySelector('[data-today-active="true"]')

    expect(button).toHaveClass('task-card__action-btn--today-active')
    expect(button).toHaveClass('text-[var(--accent)]')
  })

  it('marks an overdue deadline in the meta line without tinting the card', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T00:00:00Z'))

    const { container } = render(
      <TaskCard
        task={{
          ...task,
          dueDate: '2026-03-11',
        }}
        onSelect={vi.fn()}
      />,
    )

    const card = container.querySelector('.task-card-shell')
    const due = container.querySelector('.task-card__due')

    // Paper & Ink: color means state, and only the date carries it.
    expect(card?.className).not.toMatch(/bg-rose|border-rose/)
    expect(due).toHaveClass('text-tone-urgent')
    expect(due?.textContent).toContain('1d overdue')
  })
})
