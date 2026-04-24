import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureLabsSeedMock = vi.fn()
const tasksListMock = vi.fn()
const tasksAddMock = vi.fn()
const widgetTodoListMock = vi.fn()
const widgetTodoAddMock = vi.fn()
const diaryListMock = vi.fn()
const diaryAddMock = vi.fn()
const spendListEntriesMock = vi.fn()
const spendListCategoriesMock = vi.fn()
const spendAddCategoryMock = vi.fn()
const spendAddEntryMock = vi.fn()
const focusGetMock = vi.fn()
const focusUpsertMock = vi.fn()
const dashboardUpsertMock = vi.fn()
const lifeDashboardUpsertMock = vi.fn()
const getInitialSeedCompletedAtMock = vi.fn()
const markInitialSeedCompletedMock = vi.fn()

vi.mock('./repositories/tasksRepo', () => ({
  tasksRepo: {
    list: (...args: unknown[]) => tasksListMock(...args),
    add: (...args: unknown[]) => tasksAddMock(...args),
  },
}))

vi.mock('./repositories/widgetTodoRepo', () => ({
  widgetTodoRepo: {
    list: (...args: unknown[]) => widgetTodoListMock(...args),
    add: (...args: unknown[]) => widgetTodoAddMock(...args),
  },
}))

vi.mock('./repositories/diaryRepo', () => ({
  diaryRepo: {
    list: (...args: unknown[]) => diaryListMock(...args),
    add: (...args: unknown[]) => diaryAddMock(...args),
  },
}))

vi.mock('./repositories/spendRepo', () => ({
  spendRepo: {
    listEntries: (...args: unknown[]) => spendListEntriesMock(...args),
    listCategories: (...args: unknown[]) => spendListCategoriesMock(...args),
    addCategory: (...args: unknown[]) => spendAddCategoryMock(...args),
    addEntry: (...args: unknown[]) => spendAddEntryMock(...args),
  },
}))

vi.mock('./repositories/focusRepo', () => ({
  focusRepo: {
    get: (...args: unknown[]) => focusGetMock(...args),
    upsert: (...args: unknown[]) => focusUpsertMock(...args),
  },
}))

vi.mock('./repositories/dashboardRepo', () => ({
  dashboardRepo: {
    upsert: (...args: unknown[]) => dashboardUpsertMock(...args),
  },
}))

vi.mock('./repositories/lifeDashboardRepo', () => ({
  lifeDashboardRepo: {
    upsert: (...args: unknown[]) => lifeDashboardUpsertMock(...args),
  },
}))

vi.mock('../features/labs/labsApi', () => ({
  ensureLabsSeed: (...args: unknown[]) => ensureLabsSeedMock(...args),
}))

vi.mock('./repositories/syncedPreferencesRepo', () => ({
  syncedPreferencesRepo: {
    getInitialSeedCompletedAt: (...args: unknown[]) => getInitialSeedCompletedAtMock(...args),
    markInitialSeedCompleted: (...args: unknown[]) => markInitialSeedCompletedMock(...args),
  },
}))

import { seedDatabase } from './seed'

describe('seedDatabase', () => {
  beforeEach(() => {
    ensureLabsSeedMock.mockReset()
    tasksListMock.mockReset()
    tasksAddMock.mockReset()
    widgetTodoListMock.mockReset()
    widgetTodoAddMock.mockReset()
    diaryListMock.mockReset()
    diaryAddMock.mockReset()
    spendListEntriesMock.mockReset()
    spendListCategoriesMock.mockReset()
    spendAddCategoryMock.mockReset()
    spendAddEntryMock.mockReset()
    focusGetMock.mockReset()
    focusUpsertMock.mockReset()
    dashboardUpsertMock.mockReset()
    lifeDashboardUpsertMock.mockReset()
    getInitialSeedCompletedAtMock.mockReset()
    markInitialSeedCompletedMock.mockReset()

    getInitialSeedCompletedAtMock.mockResolvedValue(null)
    tasksListMock.mockResolvedValue([])
    widgetTodoListMock.mockResolvedValue([])
    diaryListMock.mockResolvedValue([])
    spendListEntriesMock.mockResolvedValue([])
    spendListCategoriesMock.mockResolvedValue([])
    focusGetMock.mockResolvedValue(null)
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
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not reseed once tasks already exist', async () => {
    tasksListMock.mockResolvedValueOnce([{ id: 'existing-task' }])

    await seedDatabase()

    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(widgetTodoAddMock).not.toHaveBeenCalled()
    expect(diaryAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not inspect or reseed after the initial seed marker exists', async () => {
    getInitialSeedCompletedAtMock.mockResolvedValueOnce(123)

    await seedDatabase()

    expect(tasksListMock).not.toHaveBeenCalled()
    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).not.toHaveBeenCalled()
  })
})
