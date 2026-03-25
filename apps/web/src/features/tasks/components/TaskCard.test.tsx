// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
  status: 'todo',
  priority: 'high',
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
}

describe('TaskCard', () => {
  afterEach(() => {
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

  it('highlights overdue deadlines with a stronger red treatment', () => {
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
    const deadlineBadge = Array.from(container.querySelectorAll('span')).find((element) => element.textContent === '-1d')

    expect(card?.className).toContain('!bg-rose-50/80')
    expect(card?.className).toContain('!border-rose-300/70')
    expect(deadlineBadge?.className).toContain('border-rose-300')
    expect(deadlineBadge?.className).toContain('text-rose-700')
  })
})
