import type { IDatabaseService, TaskCreateInput } from '@focus-go/core'
import { db } from '../db'
import type {
  DashboardLayout,
  DiaryEntry,
  FocusSettings,
  SpendCategory,
  SpendEntry,
  TaskItem,
  TaskStatus,
  WidgetTodo,
  WidgetTodoScope,
} from '../models/types'
import { touch, withBase } from '../repositories/base'
import { createId } from '../../shared/utils/ids'

const statusLabelMap: Record<TaskStatus, string> = {
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
}

const normalizeTask = (task: TaskItem): TaskItem => ({
  ...task,
  description: typeof task.description === 'string' ? task.description : '',
  tags: Array.isArray(task.tags) ? task.tags : [],
  subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  progressLogs: Array.isArray(task.progressLogs) ? task.progressLogs : [],
  activityLogs: Array.isArray(task.activityLogs) ? task.activityLogs : [],
})

export const createDexieDatabaseService = (): IDatabaseService => ({
  tasks: {
    async list() {
      const tasks = await db.tasks.toArray()
      const normalized = tasks.map((task) => normalizeTask(task))
      const changed = tasks.some((task, index) => {
        const next = normalized[index]
        return (
          task.description !== next.description ||
          task.tags !== next.tags ||
          task.subtasks !== next.subtasks ||
          task.progressLogs !== next.progressLogs ||
          task.activityLogs !== next.activityLogs
        )
      })
      if (changed) await db.tasks.bulkPut(normalized)
      return normalized
    },
    async add(data: TaskCreateInput) {
      const task: TaskItem = withBase({
        title: data.title,
        description: data.description ?? '',
        status: data.status,
        priority: data.priority ?? null,
        dueDate: data.dueDate,
        tags: data.tags ?? [],
        subtasks: data.subtasks ?? [],
        progressLogs: [],
        activityLogs: [],
      })
      const now = Date.now()
      task.activityLogs = [
        {
          id: createId(),
          type: 'status' as const,
          message: `Created in ${statusLabelMap[task.status]}`,
          createdAt: now,
        },
      ]
      await db.tasks.add(task)
      return task
    },
    async update(task) {
      const next = touch(normalizeTask(task as TaskItem))
      await db.tasks.put(next)
      return next
    },
    async remove(id) {
      await db.tasks.delete(id)
    },
    async updateStatus(id, status) {
      const task = await db.tasks.get(id)
      if (!task) return undefined
      const normalized = normalizeTask(task)
      if (normalized.status === status) return normalized
      const now = Date.now()
      const next = touch({
        ...normalized,
        status,
        activityLogs: [
          ...normalized.activityLogs,
          {
            id: createId(),
            type: 'status' as const,
            message: `Status changed to ${statusLabelMap[status]}`,
            createdAt: now,
          },
        ],
      })
      await db.tasks.put(next)
      return next
    },
    async appendProgress(id, content) {
      const task = await db.tasks.get(id)
      if (!task) return undefined
      const normalized = normalizeTask(task)
      const text = content.trim()
      if (!text) return normalized
      const now = Date.now()
      const next = touch({
        ...normalized,
        progressLogs: [
          ...normalized.progressLogs,
          {
            id: createId(),
            content: text,
            createdAt: now,
          },
        ],
        activityLogs: [
          ...normalized.activityLogs,
          {
            id: createId(),
            type: 'progress' as const,
            message: `Progress added: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
            createdAt: now,
          },
        ],
      })
      await db.tasks.put(next)
      return next
    },
    async clearAllTags() {
      const tasks = await db.tasks.toArray()
      const tagged = tasks.map((task) => normalizeTask(task)).filter((task) => task.tags.length > 0)
      if (tagged.length === 0) return
      await db.tasks.bulkPut(tagged.map((task) => touch({ ...task, tags: [] })))
    },
  },
  widgetTodos: {
    async list(scope?: WidgetTodoScope) {
      if (scope) return db.widgetTodos.where('scope').equals(scope).toArray()
      return db.widgetTodos.toArray()
    },
    async add(data) {
      const item = withBase(data as Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>)
      await db.widgetTodos.add(item)
      return item
    },
    async update(item) {
      const next = touch(item as WidgetTodo)
      await db.widgetTodos.put(next)
      return next
    },
    async remove(id) {
      await db.widgetTodos.delete(id)
    },
  },
  focus: {
    async get() {
      const existing = await db.focusSettings.get('focus_settings')
      return existing ?? null
    },
    async upsert(data) {
      const existing = await db.focusSettings.get('focus_settings')
      if (!existing) {
        const next = withBase({ ...(data as Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>), id: 'focus_settings' })
        await db.focusSettings.put(next)
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<FocusSettings>) })
      await db.focusSettings.put(next)
      return next
    },
  },
  diary: {
    async list() {
      return db.diaryEntries.toArray()
    },
    async listActive() {
      const entries = await db.diaryEntries.toArray()
      return entries.filter((entry) => !entry.deletedAt).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async getByDate(dateKey) {
      return db.diaryEntries.where('dateKey').equals(dateKey).first()
    },
    async listByRange(dateFrom, dateTo, options = {}) {
      const entries = await db.diaryEntries.where('dateKey').between(dateFrom, dateTo, true, true).toArray()
      const filtered = options.includeDeleted ? entries : entries.filter((entry) => !entry.deletedAt)
      return filtered.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async listTrash() {
      const entries = await db.diaryEntries.where('deletedAt').above(0).toArray()
      return entries.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    },
    async softDeleteByDate(dateKey) {
      const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: Date.now(), expiredAt: null })
      await db.diaryEntries.put(next)
      return next
    },
    async restoreByDate(dateKey) {
      const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: null, expiredAt: null })
      await db.diaryEntries.put(next)
      return next
    },
    async markExpiredOlderThan(days = 30) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const entries = await db.diaryEntries.where('deletedAt').belowOrEqual(cutoff).toArray()
      const targets = entries.filter((entry) => entry.deletedAt && !entry.expiredAt)
      if (!targets.length) return 0
      const now = Date.now()
      const updated = targets.map((entry) => touch({ ...entry, expiredAt: now }))
      await db.diaryEntries.bulkPut(updated)
      return updated.length
    },
    async hardDeleteByDate(dateKey) {
      return db.diaryEntries.where('dateKey').equals(dateKey).delete()
    },
    async add(data) {
      const entry = withBase(data as Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>)
      await db.diaryEntries.add(entry)
      return entry
    },
    async update(entry) {
      const next = touch(entry as DiaryEntry)
      await db.diaryEntries.put(next)
      return next
    },
  },
  spend: {
    async listEntries() {
      return db.spends.toArray()
    },
    async addEntry(data) {
      const entry = withBase(data as Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>)
      await db.spends.add(entry)
      return entry
    },
    async deleteEntry(id) {
      await db.spends.delete(id)
    },
    async updateEntry(entry) {
      const next = touch(entry as SpendEntry)
      await db.spends.put(next)
      return next
    },
    async listCategories() {
      return db.spendCategories.toArray()
    },
    async addCategory(data) {
      const category = withBase(data as Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>)
      await db.spendCategories.add(category)
      return category
    },
    async updateCategory(category) {
      const next = touch(category as SpendCategory)
      await db.spendCategories.put(next)
      return next
    },
  },
  dashboard: {
    async get() {
      const layout = await db.dashboardLayout.get('dashboard_layout')
      return layout ?? null
    },
    async upsert(data) {
      const existing = await db.dashboardLayout.get('dashboard_layout')
      if (!existing) {
        const next = withBase({ ...(data as Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>), id: 'dashboard_layout' })
        await db.dashboardLayout.put(next)
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<DashboardLayout>) })
      await db.dashboardLayout.put(next)
      return next
    },
  },
})
