import { describe, expect, it } from 'vitest'
import type { IDatabaseService, NoteCreateInput, TaskCreateInput } from '../src'

const makeNote = (overrides: Partial<Awaited<ReturnType<IDatabaseService['notes']['create']>>> = {}) => ({
  id: overrides.id ?? 'note-1',
  createdAt: overrides.createdAt ?? Date.now(),
  updatedAt: overrides.updatedAt ?? Date.now(),
  title: overrides.title ?? '',
  contentMd: overrides.contentMd ?? '',
  contentJson: overrides.contentJson ?? null,
  editorMode: overrides.editorMode ?? 'document',
  mindMap: overrides.mindMap ?? null,
  collection: overrides.collection ?? 'all-notes',
  tags: overrides.tags ?? [],
  excerpt: overrides.excerpt ?? '',
  pinned: overrides.pinned ?? false,
  wordCount: overrides.wordCount ?? 0,
  charCount: overrides.charCount ?? 0,
  paragraphCount: overrides.paragraphCount ?? 0,
  imageCount: overrides.imageCount ?? 0,
  fileCount: overrides.fileCount ?? 0,
  headings: overrides.headings ?? [],
  backlinks: overrides.backlinks ?? [],
  deletedAt: overrides.deletedAt ?? null,
})

const createMockService = (): IDatabaseService => ({
  tasks: {
    list: async () => [],
    add: async (data) => ({
      id: 'task-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: data.title,
      description: data.description ?? '',
      pinned: data.pinned ?? false,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      startDate: data.startDate,
      endDate: data.endDate,
      reminderAt: data.reminderAt,
      reminderFiredAt: data.reminderFiredAt,
      tags: data.tags ?? [],
      subtasks: data.subtasks ?? [],
      taskNoteBlocks: data.taskNoteBlocks ?? [],
      activityLogs: [],
    }),
    update: async (task) => task,
    remove: async () => undefined,
    updateStatus: async () => undefined,
    clearAllTags: async () => undefined,
  },
  notes: {
    list: async () => [],
    listTrash: async () => [],
    create: async (data?: NoteCreateInput) =>
      makeNote({
      title: data?.title ?? '',
      contentMd: data?.contentMd ?? '',
      contentJson: data?.contentJson ?? null,
      editorMode: data?.editorMode ?? 'document',
      mindMap: data?.mindMap ?? null,
      collection: data?.collection ?? 'all-notes',
      tags: data?.tags ?? [],
      pinned: data?.pinned ?? false,
      backlinks: data?.backlinks ?? [],
    }),
    update: async (id, patch) =>
      makeNote({
      id,
      title: patch.title ?? '',
      contentMd: patch.contentMd ?? '',
      contentJson: patch.contentJson ?? null,
      editorMode: patch.editorMode ?? 'document',
      mindMap: patch.mindMap ?? null,
      collection: patch.collection ?? 'all-notes',
      tags: patch.tags ?? [],
      excerpt: patch.excerpt ?? '',
      pinned: patch.pinned ?? false,
      wordCount: patch.wordCount ?? 0,
      charCount: patch.charCount ?? 0,
      paragraphCount: patch.paragraphCount ?? 0,
      imageCount: patch.imageCount ?? 0,
      fileCount: patch.fileCount ?? 0,
      headings: patch.headings ?? [],
      backlinks: patch.backlinks ?? [],
      deletedAt: patch.deletedAt ?? null,
    }),
    softDelete: async () => undefined,
    restore: async () => undefined,
    hardDelete: async () => undefined,
  },
  noteTags: {
    list: async () => [],
    create: async (data) => ({
      id: 'tag-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: data.name,
      icon: data.icon,
      pinned: data.pinned,
      parentId: data.parentId ?? null,
      noteCount: 0,
      sortOrder: data.sortOrder,
    }),
    update: async () => undefined,
    remove: async () => undefined,
  },
  noteAppearance: {
    get: async () => null,
    upsert: async (data) => ({
      id: 'note_appearance',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      theme: data.theme ?? 'paper',
      font: data.font ?? 'uiSans',
      fontSize: data.fontSize ?? 16,
      lineHeight: data.lineHeight ?? 1.7,
      contentWidth: data.contentWidth ?? 0,
      focusMode: data.focusMode ?? false,
    }),
  },
  widgetTodos: {
    list: async () => [],
    add: async (item) => ({ id: 'w-1', createdAt: Date.now(), updatedAt: Date.now(), ...item }),
    update: async (item) => item,
    resetDone: async () => [],
    remove: async () => undefined,
  },
  focus: {
    get: async () => null,
    upsert: async (data) => ({ id: 'focus-settings', createdAt: Date.now(), updatedAt: Date.now(), ...data }),
  },
  focusSessions: {
    list: async () => [],
    start: async (data) => ({
      id: 'focus-session-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'active' as const,
      plannedMinutes: data.plannedMinutes,
      taskId: data.taskId,
      goal: data.goal,
    }),
    complete: async () => undefined,
  },
  diary: {
    list: async () => [],
    listActive: async () => [],
    getByDate: async () => undefined,
    listByRange: async () => [],
    listTrash: async () => [],
    softDeleteByDate: async () => null,
    restoreByDate: async () => null,
    markExpiredOlderThan: async () => 0,
    hardDeleteByDate: async () => 0,
    add: async (entry) => ({ id: 'diary-1', createdAt: Date.now(), updatedAt: Date.now(), ...entry }),
    update: async (entry) => entry,
  },
  spend: {
    listEntries: async () => [],
    addEntry: async (entry) => ({ id: 'spend-1', createdAt: Date.now(), updatedAt: Date.now(), ...entry }),
    deleteEntry: async () => undefined,
    updateEntry: async (entry) => entry,
    listCategories: async () => [],
    addCategory: async (category) => ({ id: 'cat-1', createdAt: Date.now(), updatedAt: Date.now(), ...category }),
    updateCategory: async (category) => category,
  },
  dashboard: {
    get: async () => null,
    upsert: async (data) => ({ id: 'dashboard', createdAt: Date.now(), updatedAt: Date.now(), ...data }),
  },
  habits: {
    listHabits: async () => [],
    createHabit: async (data) => ({ id: 'habit-1', createdAt: Date.now(), updatedAt: Date.now(), ...data }),
    updateHabit: async () => undefined,
    archiveHabit: async () => undefined,
    restoreHabit: async () => undefined,
    reorderHabits: async () => undefined,
    recordHabitCompletion: async () => ({
      id: 'habit-log-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: 'user-1',
      habitId: 'habit-1',
      dateKey: '2026-03-12',
      status: 'completed',
    }),
    undoHabitCompletion: async () => undefined,
    listHabitLogs: async () => [],
    computeHabitStreak: async () => 0,
    getDailyProgress: async () => ({ completed: 0, total: 0, percent: 0 }),
    getHeatmap: async () => [],
  },
})

describe('IDatabaseService contract', () => {
  it('contains all required data access groups', () => {
    const service = createMockService()
    expect(Object.keys(service).sort()).toEqual([
      'dashboard',
      'diary',
      'focus',
      'focusSessions',
      'habits',
      'noteAppearance',
      'noteTags',
      'notes',
      'spend',
      'tasks',
      'widgetTodos',
    ])
  })

  it('accepts minimal task create payload', async () => {
    const payload: TaskCreateInput = {
      title: 'Task',
      status: 'todo',
      priority: null,
    }
    const service = createMockService()
    const created = await service.tasks.add(payload)
    expect(created.title).toBe('Task')
    expect(created.status).toBe('todo')
  })

  it('accepts minimal note create payload', async () => {
    const service = createMockService()
    const created = await service.notes.create({ title: 'Note' })

    expect(created.title).toBe('Note')
    expect(created.collection).toBe('all-notes')
  })
})
