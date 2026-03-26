import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureLabsSeedMock = vi.fn()
const tasksListMock = vi.fn()
const tasksAddMock = vi.fn()
const widgetTodoAddMock = vi.fn()
const diaryAddMock = vi.fn()
const spendAddCategoryMock = vi.fn()
const spendAddEntryMock = vi.fn()
const focusUpsertMock = vi.fn()
const dashboardUpsertMock = vi.fn()

vi.mock('./repositories/tasksRepo', () => ({
  tasksRepo: {
    list: (...args: unknown[]) => tasksListMock(...args),
    add: (...args: unknown[]) => tasksAddMock(...args),
  },
}))

vi.mock('./repositories/widgetTodoRepo', () => ({
  widgetTodoRepo: {
    add: (...args: unknown[]) => widgetTodoAddMock(...args),
  },
}))

vi.mock('./repositories/diaryRepo', () => ({
  diaryRepo: {
    add: (...args: unknown[]) => diaryAddMock(...args),
  },
}))

vi.mock('./repositories/spendRepo', () => ({
  spendRepo: {
    addCategory: (...args: unknown[]) => spendAddCategoryMock(...args),
    addEntry: (...args: unknown[]) => spendAddEntryMock(...args),
  },
}))

vi.mock('./repositories/focusRepo', () => ({
  focusRepo: {
    upsert: (...args: unknown[]) => focusUpsertMock(...args),
  },
}))

vi.mock('./repositories/dashboardRepo', () => ({
  dashboardRepo: {
    upsert: (...args: unknown[]) => dashboardUpsertMock(...args),
  },
}))

vi.mock('../features/labs/labsApi', () => ({
  ensureLabsSeed: (...args: unknown[]) => ensureLabsSeedMock(...args),
}))

import { seedDatabase } from './seed'

describe('seedDatabase', () => {
  beforeEach(() => {
    ensureLabsSeedMock.mockReset()
    tasksListMock.mockReset()
    tasksAddMock.mockReset()
    widgetTodoAddMock.mockReset()
    diaryAddMock.mockReset()
    spendAddCategoryMock.mockReset()
    spendAddEntryMock.mockReset()
    focusUpsertMock.mockReset()
    dashboardUpsertMock.mockReset()

    tasksListMock.mockResolvedValue([])
    spendAddCategoryMock
      .mockResolvedValueOnce({ id: 'focus' })
      .mockResolvedValueOnce({ id: 'life' })
  })

  it('seeds a lightweight dashboard-first sample set on first run', async () => {
    await seedDatabase()

    expect(tasksAddMock).toHaveBeenCalledTimes(1)
    expect(tasksAddMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Plan today around one meaningful task',
      status: 'todo',
    }))

    expect(widgetTodoAddMock).toHaveBeenCalledTimes(1)
    expect(diaryAddMock).toHaveBeenCalledTimes(1)
    expect(spendAddEntryMock).toHaveBeenCalledTimes(1)
  })

  it('does not reseed once tasks already exist', async () => {
    tasksListMock.mockResolvedValueOnce([{ id: 'existing-task' }])

    await seedDatabase()

    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(widgetTodoAddMock).not.toHaveBeenCalled()
    expect(diaryAddMock).not.toHaveBeenCalled()
  })
})
