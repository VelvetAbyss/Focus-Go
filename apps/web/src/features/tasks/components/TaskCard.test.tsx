// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  progressLogs: [],
  activityLogs: [],
}

describe('TaskCard', () => {
  it('uses animated reveal classes for hover content', () => {
    render(
      <TaskCard
        task={task}
        onSelect={vi.fn()}
        progressComposer={{
          isOpen: false,
          value: '',
          onToggle: vi.fn(),
          onChange: vi.fn(),
          onSubmit: vi.fn(),
          onCancel: vi.fn(),
        }}
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
})
