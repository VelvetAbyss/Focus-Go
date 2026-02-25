import { describe, expect, it } from 'vitest'
import type { IDatabaseService, TaskCreateInput } from '../src'

const createMockService = (): IDatabaseService => ({
  tasks: {
    list: async () => [],
    add: async (data) => ({
      id: 'task-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: data.title,
      description: data.description ?? '',
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      tags: data.tags ?? [],
      subtasks: data.subtasks ?? [],
      progressLogs: [],
      activityLogs: [],
    }),
    update: async (task) => task,
    remove: async () => undefined,
    updateStatus: async () => undefined,
    appendProgress: async () => undefined,
    clearAllTags: async () => undefined,
  },
  widgetTodos: {
    list: async () => [],
    add: async (item) => ({ id: 'w-1', createdAt: Date.now(), updatedAt: Date.now(), ...item }),
    update: async (item) => item,
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
})

describe('IDatabaseService contract', () => {
  it('contains all required data access groups', () => {
    const service = createMockService()
    expect(Object.keys(service).sort()).toEqual(['dashboard', 'diary', 'focus', 'focusSessions', 'spend', 'tasks', 'widgetTodos'])
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
})
