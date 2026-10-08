// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  it('swaps the footer to the action row in place on hover instead of growing the card', () => {
    render(
      <TaskCard
        task={task}
        onSelect={vi.fn()}
      />,
    )

    const card = screen.getByText('Write hover animation').closest('.task-card-shell')
    const actions = screen.getByTestId('task-card-actions')
    const foot = actions.closest('.task-card__foot')

    expect(card).not.toBeNull()
    // Resting face and actions share the footer's single grid cell.
    expect(foot).not.toBeNull()
    expect(foot?.querySelector('.task-card__foot-rest')).not.toBeNull()
    expect(foot).toHaveAttribute('data-revealed', 'false')

    fireEvent.mouseEnter(card!)
    expect(foot).toHaveAttribute('data-revealed', 'true')

    fireEvent.mouseLeave(card!)
    expect(foot).toHaveAttribute('data-revealed', 'false')
  })

  it('keeps one footer line with state on the left and the project on the right', () => {
    const { container } = render(
      <TaskCard
        task={{ ...task, dueDate: '2026-09-25', tags: ['ops', 'q4'], subtasks: [{ id: 's1', title: 'a', done: true }, { id: 's2', title: 'b', done: false }] } as TaskItem}
        project={{ id: 'p1', title: 'Lowes', color: '#3d7a6c' }}
        onSelect={vi.fn()}
      />,
    )

    const rest = container.querySelector('.task-card__foot-rest')
    // No second "context" row any more: project and tags live in the footer.
    expect(container.querySelector('.task-card__context')).toBeNull()
    expect(rest?.querySelector('.task-card__meta')).not.toBeNull()
    expect(rest?.querySelector('.task-card__project-chip')).toHaveTextContent('Lowes')
    expect(rest?.querySelector('.task-card__meta')).toHaveTextContent('1/2')
    expect(rest?.querySelector('.task-card__meta')).toHaveTextContent('#ops+1')
  })

  it('renders the footer even when a task has no meta, so every card keeps the same height', () => {
    const { container } = render(<TaskCard task={{ ...task, priority: null }} onSelect={vi.fn()} />)

    expect(container.querySelector('.task-card__foot')).not.toBeNull()
    expect(container.querySelector('.task-card__meta')?.childElementCount).toBe(0)
    expect(container.querySelector('.task-card__title')).toHaveClass('line-clamp-2')
  })

  it('does not print "Invalid Date" for a malformed due date', () => {
    const { container } = render(
      <TaskCard task={{ ...task, dueDate: '2026/9/25 18:00' }} onSelect={vi.fn()} />,
    )

    expect(container.textContent).not.toContain('Invalid Date')
    expect(container.querySelector('.task-card__due')).toBeNull()
  })

  it('opens the subtask peek after a short rest, outside the card, and closes it on leave', () => {
    vi.useFakeTimers()
    const { container } = render(
      <TaskCard
        task={{ ...task, subtasks: [{ id: 's1', title: 'Draft copy', done: false }, { id: 's2', title: 'Ship', done: true }] } as TaskItem}
        onSelect={vi.fn()}
      />,
    )
    const card = container.querySelector('.task-card-shell')!

    fireEvent.mouseEnter(card)
    expect(screen.queryByTestId('task-card-peek')).not.toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(450) })
    const peek = screen.getByTestId('task-card-peek')
    expect(peek).toHaveTextContent('Draft copy')
    // Portaled: the card's own box is untouched.
    expect(card.contains(peek)).toBe(false)

    fireEvent.mouseLeave(card)
    expect(screen.queryByTestId('task-card-peek')).not.toBeInTheDocument()
  })

  it('does not open a peek when a quick sweep leaves before the rest delay', () => {
    vi.useFakeTimers()
    const { container } = render(
      <TaskCard task={{ ...task, subtasks: [{ id: 's1', title: 'Draft copy', done: false }] } as TaskItem} onSelect={vi.fn()} />,
    )
    const card = container.querySelector('.task-card-shell')!

    fireEvent.mouseEnter(card)
    act(() => { vi.advanceTimersByTime(150) })
    fireEvent.mouseLeave(card)
    act(() => { vi.advanceTimersByTime(1000) })

    expect(screen.queryByTestId('task-card-peek')).not.toBeInTheDocument()
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

  it('says who a waiting task waits on, and how it repeats, in the meta line', () => {
    const now = new Date()
    render(
      <TaskCard
        task={{
          ...task,
          status: 'waiting',
          waitingOn: 'Mac (Lowe’s)',
          waitingSince: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 9).getTime(),
          recurrence: { frequency: 'weekly', interval: 1 },
        }}
        onSelect={() => undefined}
      />,
    )
    const status = screen.getByText(/Waiting on Mac \(Lowe’s\)/).closest('[data-status="waiting"]')
    expect(status).toHaveTextContent('Waiting on Mac (Lowe’s) · 6d')
    expect(screen.getByText('Weekly')).toBeInTheDocument()
  })

  it('strikes through a dropped task like a finished one', () => {
    render(<TaskCard task={{ ...task, status: 'dropped', dropReason: 'No longer needed' }} onSelect={() => undefined} />)
    expect(screen.getByRole('heading', { name: task.title })).toHaveClass('line-through')
    expect(screen.getByText('Dropped')).toHaveAttribute('title', 'No longer needed')
  })
})
