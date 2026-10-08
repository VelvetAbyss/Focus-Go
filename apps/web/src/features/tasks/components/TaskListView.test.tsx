// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { TaskItem } from '../tasks.types'
import TaskListView from './TaskListView'

const dnd = vi.hoisted(() => ({ onDragEnd: undefined as undefined | ((event: unknown) => void) }))
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd: (event: unknown) => void }) => { dnd.onDragEnd = onDragEnd; return children },
  DragOverlay: ({ children }: { children: ReactNode }) => children,
  PointerSensor: vi.fn(), useSensor: vi.fn(), useSensors: vi.fn(),
  useDraggable: () => ({ setNodeRef: vi.fn(), isDragging: false }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}))
vi.mock('./TaskRow', () => ({ default: ({ task, onClick }: { task: TaskItem; onClick: (task: TaskItem) => void }) => <button onClick={() => onClick?.(task)}>{task.title}</button> }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const task = (id: string, status: TaskItem['status']) => ({ id, title: id, status } as TaskItem)
afterEach(() => { cleanup(); localStorage.clear() })
const baseProps = { projectById: new Map(), onTaskClick: vi.fn(), onCycleStatus: vi.fn() }

describe('Task workflow queues', () => {
  it('keeps external waiting and internal verification in separate queues', () => {
    render(<TaskListView {...baseProps} tasks={[task('waiting-response', 'waiting'), task('verify-proof', 'verify')]} />)
    expect(within(screen.getByRole('region', { name: 'tasks.status.waiting' })).getByText('waiting-response')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'tasks.status.verify' })).getByText('verify-proof')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'tasks.status.waiting' })).queryByText('verify-proof')).not.toBeInTheDocument()
  })
  it('moves waiting into verification and ignores unknown drop targets', () => {
    const onMoveTask = vi.fn(), waiting = task('waiting-response', 'waiting')
    render(<TaskListView {...baseProps} onMoveTask={onMoveTask} tasks={[waiting]} />)
    dnd.onDragEnd?.({ active: { id: waiting.id }, over: { id: 'verify' } })
    expect(onMoveTask).toHaveBeenCalledWith(waiting, 'verify')
    dnd.onDragEnd?.({ active: { id: waiting.id }, over: { id: 'unknown' } })
    expect(onMoveTask).toHaveBeenCalledTimes(1)
  })
  it('keeps dropped tasks off the board and expands real completed work', () => {
    render(<TaskListView {...baseProps} tasks={[task('dropped-item', 'dropped'), ...Array.from({ length: 6 }, (_, i) => task(`done-${i}`, 'done'))]} />)
    expect(screen.queryByText('dropped-item')).not.toBeInTheDocument()
    expect(screen.queryByText('done-5')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'tasks.list.showAll' }))
    expect(screen.getByText('done-5')).toBeInTheDocument()
    expect(localStorage.getItem('tasks_list_done_expanded')).toBe('1')
  })
})
