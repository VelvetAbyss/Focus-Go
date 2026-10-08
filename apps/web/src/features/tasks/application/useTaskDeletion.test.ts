// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskNoteLink } from '../../../data/models/types'
import type { ToastPushArgs } from '../../../shared/ui/toast/toast'
import type { TaskItem } from '../tasks.types'

const pushMock = vi.fn<(args: ToastPushArgs) => void>()
const emitTasksChangedMock = vi.fn()

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

vi.mock('../../../shared/ui/toast/toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

vi.mock('../taskSync', () => ({
  emitTasksChanged: (...args: unknown[]) => emitTasksChangedMock(...args),
}))

vi.mock('../../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    remove: vi.fn(),
    restore: vi.fn(),
  },
}))

import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { useTaskDeletion } from './useTaskDeletion'

const makeTask = (id: string, title: string) => ({ id, title, tags: [], subtasks: [], createdAt: 1, updatedAt: 1 }) as unknown as TaskItem
const link = (taskId: string) => ({ id: `${taskId}:n1`, taskId, noteId: 'n1', order: 0, createdAt: 1, updatedAt: 1 }) as TaskNoteLink

describe('useTaskDeletion', () => {
  beforeEach(() => {
    pushMock.mockReset()
    emitTasksChangedMock.mockReset()
    vi.mocked(tasksRepo.remove).mockReset()
    vi.mocked(tasksRepo.restore).mockReset()
  })

  it('deletes and offers an undo that restores the task with its note links', async () => {
    const task = makeTask('t1', 'Call Lowe’s')
    vi.mocked(tasksRepo.remove).mockResolvedValue([link('t1')])
    vi.mocked(tasksRepo.restore).mockResolvedValue(task)
    const { result } = renderHook(() => useTaskDeletion())

    await act(() => result.current([task], 'test'))

    expect(tasksRepo.remove).toHaveBeenCalledWith('t1')
    expect(emitTasksChangedMock).toHaveBeenCalledWith('test:delete')
    const toast = pushMock.mock.calls[0][0]
    expect(toast.message).toBe('Deleted “Call Lowe’s”')
    expect(toast.actionLabel).toBe('Undo')

    await act(async () => {
      toast.onAction?.()
    })

    expect(tasksRepo.restore).toHaveBeenCalledWith(task, [link('t1')])
    expect(emitTasksChangedMock).toHaveBeenCalledWith('test:undo-delete')
  })

  it('counts several tasks in one notice and restores them all', async () => {
    const tasks = [makeTask('a', 'A'), makeTask('b', 'B'), makeTask('c', 'C')]
    vi.mocked(tasksRepo.remove).mockResolvedValue([])
    vi.mocked(tasksRepo.restore).mockImplementation(async (task) => task)
    const { result } = renderHook(() => useTaskDeletion())

    await act(() => result.current(tasks, 'bulk'))

    expect(tasksRepo.remove).toHaveBeenCalledTimes(3)
    expect(pushMock).toHaveBeenCalledTimes(1)
    const toast = pushMock.mock.calls[0][0]
    expect(toast.message).toBe('Deleted 3 tasks')

    await act(async () => {
      toast.onAction?.()
    })
    expect(tasksRepo.restore).toHaveBeenCalledTimes(3)
  })

  it('says so when the undo fails', async () => {
    vi.mocked(tasksRepo.remove).mockResolvedValue([])
    vi.mocked(tasksRepo.restore).mockRejectedValue(new Error('offline'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result } = renderHook(() => useTaskDeletion())

    await act(() => result.current([makeTask('x', 'X')], 'test'))
    await act(async () => {
      pushMock.mock.calls[0][0].onAction?.()
    })

    expect(pushMock).toHaveBeenLastCalledWith(expect.objectContaining({ variant: 'error' }))
    expect(emitTasksChangedMock).not.toHaveBeenCalledWith('test:undo-delete')
    consoleSpy.mockRestore()
  })

  it('does nothing for an empty selection', async () => {
    const { result } = renderHook(() => useTaskDeletion())
    await act(() => result.current([], 'test'))
    expect(tasksRepo.remove).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
