import { describe, expect, it, vi } from 'vitest'
import type { TaskItem } from './tasks.types'

const updateMock = vi.fn(async (task: TaskItem) => task)
const takeMock = vi.fn()

vi.mock('../../data/repositories/tasksRepo', () => ({
  tasksRepo: { update: (task: TaskItem) => updateMock(task), list: vi.fn(async () => []) },
}))
vi.mock('../../shared/push/webPush', () => ({
  takePushFiredReminders: () => takeMock(),
}))

import { markPushedRemindersFired } from './useTaskReminderEngine'

const task = (patch: Partial<TaskItem>) => ({ id: 't', title: 'T', ...patch }) as TaskItem

describe('markPushedRemindersFired', () => {
  it('marks reminders a push already showed, and only those', async () => {
    takeMock.mockResolvedValue([
      { taskId: 'shown', reminderAt: 1_000, firedAt: 1_005 },
      { taskId: 'moved', reminderAt: 1_000, firedAt: 1_005 },
      { taskId: 'gone', reminderAt: 1_000, firedAt: 1_005 },
    ])
    const tasks = [
      task({ id: 'shown', reminderAt: 1_000 }),
      // Rescheduled since the push: the new reminder still has to fire.
      task({ id: 'moved', reminderAt: 9_000 }),
      task({ id: 'untouched', reminderAt: 1_000 }),
    ]

    const result = await markPushedRemindersFired(tasks)

    expect(updateMock).toHaveBeenCalledTimes(1)
    expect(result.find((item) => item.id === 'shown')?.reminderFiredAt).toBe(1_005)
    expect(result.find((item) => item.id === 'moved')?.reminderFiredAt).toBeUndefined()
    expect(result.find((item) => item.id === 'untouched')?.reminderFiredAt).toBeUndefined()
  })

  it('leaves the list alone when nothing was pushed', async () => {
    takeMock.mockResolvedValue([])
    const tasks = [task({ id: 'a', reminderAt: 1 })]
    expect(await markPushedRemindersFired(tasks)).toBe(tasks)
  })
})
