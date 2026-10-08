// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskRow from './TaskRow'
import type { TaskItem } from '../tasks.types'
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const task = { id: 'task', title: 'Review the certification report', status: 'todo', priority: null, tags: [], subtasks: [], isToday: false, pinned: false } as unknown as TaskItem
afterEach(cleanup)

describe('Task row actions', () => {
  it('opens from the row and advances only from the status mark', () => {
    const onClick = vi.fn(), onCycleStatus = vi.fn()
    render(<TaskRow task={task} onClick={onClick} onCycleStatus={onCycleStatus} />)
    fireEvent.keyDown(screen.getByText(task.title).closest('[role="button"]')!, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'tasks.status.start' }))
    expect(onCycleStatus).toHaveBeenCalledWith(task)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
  it('does not open the task or advance status from nested delete controls', () => {
    const onClick = vi.fn(), onCycleStatus = vi.fn(), onDelete = vi.fn()
    render(<TaskRow task={task} onClick={onClick} onCycleStatus={onCycleStatus} onDelete={onDelete} />)
    const button = screen.getByRole('button', { name: 'tasks.card.delete' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.click(button)
    expect(onDelete).toHaveBeenCalledWith(task)
    expect(onClick).not.toHaveBeenCalled()
    expect(onCycleStatus).not.toHaveBeenCalled()
  })
})
