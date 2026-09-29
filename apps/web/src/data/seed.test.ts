import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureLabsSeedMock = vi.fn()
const isLocalOnlyModeMock = vi.fn()
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
const projectsListMock = vi.fn()
const projectsCreateMock = vi.fn()
const projectPeopleCreateMock = vi.fn()
const notesListMock = vi.fn()
const notesCreateMock = vi.fn()
const getInitialSeedCompletedAtMock = vi.fn()
const markInitialSeedCompletedMock = vi.fn()
const claimInitialSeedMock = vi.fn()
const getAuthMock = vi.fn()
const readLanguageMock = vi.fn()

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

vi.mock('./repositories/projectsRepo', () => ({
  projectTagName: (projectId: string) => `project:${projectId}`,
  projectsRepo: {
    list: (...args: unknown[]) => projectsListMock(...args),
    create: (...args: unknown[]) => projectsCreateMock(...args),
  },
}))

vi.mock('./repositories/projectPeopleRepo', () => ({
  projectPeopleRepo: {
    create: (...args: unknown[]) => projectPeopleCreateMock(...args),
  },
}))

vi.mock('./repositories/notesRepo', () => ({
  notesRepo: {
    list: (...args: unknown[]) => notesListMock(...args),
    create: (...args: unknown[]) => notesCreateMock(...args),
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

vi.mock('./sync/seedClaim', () => ({
  claimInitialSeed: (...args: unknown[]) => claimInitialSeedMock(...args),
}))

vi.mock('../store/auth', () => ({
  getAuth: (...args: unknown[]) => getAuthMock(...args),
}))

vi.mock('./storageMode', () => ({
  isLocalOnlyMode: (...args: unknown[]) => isLocalOnlyModeMock(...args),
}))

vi.mock('../shared/prefs/preferences', () => ({
  readLanguage: (...args: unknown[]) => readLanguageMock(...args),
}))

import { seedDatabase } from './seed'

describe('seedDatabase', () => {
  beforeEach(() => {
    ensureLabsSeedMock.mockReset()
    isLocalOnlyModeMock.mockReset()
    isLocalOnlyModeMock.mockReturnValue(false)
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
    projectsListMock.mockReset()
    projectsCreateMock.mockReset()
    projectPeopleCreateMock.mockReset()
    notesListMock.mockReset()
    notesCreateMock.mockReset()
    getInitialSeedCompletedAtMock.mockReset()
    markInitialSeedCompletedMock.mockReset()
    claimInitialSeedMock.mockReset()
    getAuthMock.mockReset()
    readLanguageMock.mockReset()

    getAuthMock.mockReturnValue({ user: { id: 'u1' } })
    readLanguageMock.mockReturnValue('en')
    claimInitialSeedMock.mockResolvedValue({ shouldSeed: true, seededAt: '2026-01-01T00:00:00Z' })
    getInitialSeedCompletedAtMock.mockResolvedValue(null)
    tasksListMock.mockResolvedValue([])
    tasksAddMock.mockImplementation(async (data: { title: string }) => ({ id: `task-${tasksAddMock.mock.calls.length}`, ...data }))
    widgetTodoListMock.mockResolvedValue([])
    diaryListMock.mockResolvedValue([])
    spendListEntriesMock.mockResolvedValue([])
    spendListCategoriesMock.mockResolvedValue([])
    focusGetMock.mockResolvedValue(null)
    projectsListMock.mockResolvedValue([])
    projectsCreateMock.mockResolvedValue({ id: 'project-1', title: 'Sample Project: Launch a Personal Productivity System' })
    projectPeopleCreateMock.mockImplementation(async (data: { name: string }) => ({ id: `person-${projectPeopleCreateMock.mock.calls.length}`, ...data }))
    notesListMock.mockResolvedValue([])
    notesCreateMock.mockImplementation(async (data: { title: string }) => ({ id: `note-${notesCreateMock.mock.calls.length}`, ...data }))
    spendAddCategoryMock.mockResolvedValue({ id: 'life' })
  })

  it('seeds an English onboarding task, sample project, project tasks, and notes on first run', async () => {
    await seedDatabase()

    expect(tasksAddMock).toHaveBeenCalledTimes(5)
    expect(tasksAddMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: 'Get started with Focus&go',
      description: expect.stringContaining('tasks, focus, diary, notes, projects, and settings'),
      status: 'todo',
      priority: 'high',
      isToday: true,
      tags: ['today', 'onboarding'],
      subtasks: expect.arrayContaining([
        expect.objectContaining({ title: 'Create or organize a task on the board', done: false }),
        expect.objectContaining({ title: 'Open Project and inspect tasks, timeline, people, and notes', done: false }),
      ]),
      taskNoteContentMd: expect.stringContaining('task details'),
    }))

    expect(projectsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sample Project: Launch a Personal Productivity System',
      status: 'active',
      priority: 'high',
    }))
    expect(projectPeopleCreateMock).toHaveBeenCalledTimes(3)
    expect(projectPeopleCreateMock).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', roleType: 'owner' }))
    expect(tasksAddMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Organize the task board and timeline',
      projectId: 'project-1',
      ownerId: 'person-2',
      status: 'doing',
    }))
    expect(tasksAddMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Wait for review feedback',
      projectId: 'project-1',
      isBlocked: true,
    }))
    expect(notesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Project Note: Personal Productivity System',
      tags: ['project:project-1', 'Projects'],
    }))
    expect(notesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Welcome to Notes',
      pinned: true,
      tags: ['Ideas'],
    }))
    expect(widgetTodoAddMock).toHaveBeenCalledTimes(1)
    expect(widgetTodoAddMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Keep today light: one key task, one focus session, one review.',
    }))
    expect(diaryAddMock).toHaveBeenCalledTimes(1)
    expect(spendAddEntryMock).toHaveBeenCalledTimes(1)
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('seeds localized Chinese sample content when the current language is zh', async () => {
    readLanguageMock.mockReturnValueOnce('zh')
    projectsCreateMock.mockResolvedValueOnce({ id: 'project-zh', title: '示例项目：个人效率系统上线' })

    await seedDatabase()

    expect(tasksAddMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: '开始使用 Focus&go',
      description: expect.stringContaining('快速体验任务、专注、日记、笔记、项目和设置'),
      taskNoteContentMd: expect.stringContaining('欢迎来到 Focus&go'),
    }))
    expect(projectsCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '示例项目：个人效率系统上线',
      goal: expect.stringContaining('个人工作流'),
    }))
    expect(notesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '项目笔记：个人效率系统上线',
      tags: ['project:project-zh', 'Projects'],
    }))
    expect(notesCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '欢迎使用 Note',
      pinned: true,
    }))
    expect(widgetTodoAddMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '今天保持轻量：一个重点任务，一次专注，一段复盘。',
    }))
  })

  it('does not reseed once tasks already exist', async () => {
    tasksListMock.mockResolvedValueOnce([{ id: 'existing-task' }])

    await seedDatabase()

    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(widgetTodoAddMock).not.toHaveBeenCalled()
    expect(diaryAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not reseed once projects already exist', async () => {
    projectsListMock.mockResolvedValueOnce([{ id: 'existing-project' }])

    await seedDatabase()

    expect(projectsCreateMock).not.toHaveBeenCalled()
    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(notesCreateMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not reseed once notes already exist', async () => {
    notesListMock.mockResolvedValueOnce([{ id: 'existing-note' }])

    await seedDatabase()

    expect(projectsCreateMock).not.toHaveBeenCalled()
    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(notesCreateMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not inspect or reseed after the initial seed marker exists', async () => {
    getInitialSeedCompletedAtMock.mockResolvedValueOnce(123)

    await seedDatabase()

    expect(tasksListMock).not.toHaveBeenCalled()
    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).not.toHaveBeenCalled()
  })

  it('skips entirely when no user is logged in', async () => {
    getAuthMock.mockReturnValue(null)

    await seedDatabase()

    expect(claimInitialSeedMock).not.toHaveBeenCalled()
    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).not.toHaveBeenCalled()
  })

  it('honors the server claim and skips when shouldSeed is false', async () => {
    claimInitialSeedMock.mockResolvedValueOnce({ shouldSeed: false, seededAt: '2025-01-01T00:00:00Z' })

    await seedDatabase()

    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
  })

  it('does not seed when the claim endpoint errors', async () => {
    claimInitialSeedMock.mockRejectedValueOnce(new Error('network'))

    await seedDatabase()

    expect(tasksAddMock).not.toHaveBeenCalled()
    expect(markInitialSeedCompletedMock).not.toHaveBeenCalled()
  })

  describe('local-only devices', () => {
    beforeEach(() => {
      isLocalOnlyModeMock.mockReturnValue(true)
      getAuthMock.mockReturnValue(null)
    })

    it('seeds the first-run workspace with no account and no server claim', async () => {
      await seedDatabase()

      expect(claimInitialSeedMock).not.toHaveBeenCalled()
      expect(tasksAddMock).toHaveBeenCalled()
      expect(markInitialSeedCompletedMock).toHaveBeenCalledTimes(1)
    })

    it('still honours the local marker so it seeds exactly once', async () => {
      getInitialSeedCompletedAtMock.mockResolvedValueOnce(123)

      await seedDatabase()

      expect(tasksAddMock).not.toHaveBeenCalled()
      expect(markInitialSeedCompletedMock).not.toHaveBeenCalled()
    })
  })
})
