import { describe, expect, it } from 'vitest'
import { getNextReminderDueAt } from './useTaskReminderEngine'
import type { TaskItem } from './tasks.types'

const task = (patch: Partial<TaskItem>) => patch as TaskItem

describe('getNextReminderDueAt', () => {
  it('returns the earliest unfired reminder minus the lead time', () => {
    const tasks = [
      task({ id: 'a', reminderAt: 5_000_000 }),
      task({ id: 'b', reminderAt: 2_000_000 }),
      task({ id: 'c', reminderAt: 1_000_000, reminderFiredAt: 900_000 }),
      task({ id: 'd' }),
    ]
    expect(getNextReminderDueAt(tasks, 600_000)).toBe(1_400_000)
  })

  it('returns null when nothing is pending', () => {
    expect(getNextReminderDueAt([task({ id: 'a', reminderAt: 1, reminderFiredAt: 2 })], 0)).toBeNull()
    expect(getNextReminderDueAt([], 0)).toBeNull()
  })
})
