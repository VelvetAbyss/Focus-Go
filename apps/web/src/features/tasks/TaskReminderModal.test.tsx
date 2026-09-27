// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

import TaskReminderModal from './TaskReminderModal'
import { reminderQueueStore } from './reminderQueueStore'
import type { TaskItem } from './tasks.types'

const task = (id: string, title: string): TaskItem => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  title,
  description: '',
  pinned: false,
  isToday: false,
  status: 'todo',
  priority: 'medium',
  tags: [],
  subtasks: [],
  taskNoteBlocks: [],
  activityLogs: [],
})

describe('TaskReminderModal', () => {
  afterEach(() => {
    act(() => reminderQueueStore.clear())
    cleanup()
  })

  it('shows a reminder as soon as it is queued and closes it on dismiss', () => {
    render(
      <MemoryRouter>
        <TaskReminderModal />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Ship the release')).not.toBeInTheDocument()

    act(() => reminderQueueStore.enqueue(task('t-1', 'Ship the release')))
    expect(screen.getByText('Ship the release')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Ship the release')).not.toBeInTheDocument()
  })

  it('advances to the next queued reminder after dismissing the first', () => {
    render(
      <MemoryRouter>
        <TaskReminderModal />
      </MemoryRouter>,
    )
    act(() => {
      reminderQueueStore.enqueue(task('t-1', 'First reminder'))
      reminderQueueStore.enqueue(task('t-2', 'Second reminder'))
    })
    expect(screen.getByText('First reminder')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.getByText('Second reminder')).toBeInTheDocument()
  })
})
