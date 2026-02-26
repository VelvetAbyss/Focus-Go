import type { IDatabaseService, TaskCreateInput } from '@focus-go/core'
import { db } from '../db'
import type {
  DashboardLayout,
  DiaryEntry,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  HabitStatus,
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
  dueDate: typeof task.dueDate === 'string' && task.dueDate ? task.dueDate : undefined,
  startDate: typeof task.startDate === 'string' && task.startDate ? task.startDate : undefined,
  endDate: typeof task.endDate === 'string' && task.endDate ? task.endDate : undefined,
  reminderAt: typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt) ? task.reminderAt : undefined,
  reminderFiredAt:
    typeof task.reminderFiredAt === 'number' && Number.isFinite(task.reminderFiredAt) ? task.reminderFiredAt : undefined,
  tags: Array.isArray(task.tags) ? task.tags : [],
  subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  progressLogs: Array.isArray(task.progressLogs) ? task.progressLogs : [],
  activityLogs: Array.isArray(task.activityLogs) ? task.activityLogs : [],
})

const MS_PER_DAY = 24 * 60 * 60 * 1000

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

const moveDateKey = (dateKey: string, offset: number) => {
  const next = parseDateKey(dateKey)
  next.setDate(next.getDate() + offset)
  return toDateKey(next)
}

export const createDexieDatabaseService = (): IDatabaseService => ({
  tasks: {
    async list() {
      const tasks = await db.tasks.toArray()
      const normalized = tasks.map((task) => normalizeTask(task))
      const changed = tasks.some((task, index) => {
        const next = normalized[index]
        return (
          task.description !== next.description ||
          task.dueDate !== next.dueDate ||
          task.startDate !== next.startDate ||
          task.endDate !== next.endDate ||
          task.reminderAt !== next.reminderAt ||
          task.reminderFiredAt !== next.reminderFiredAt ||
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
        startDate: data.startDate,
        endDate: data.endDate,
        reminderAt: data.reminderAt,
        reminderFiredAt: data.reminderFiredAt,
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
  focusSessions: {
    async list(limit) {
      const rows = await db.focusSessions.orderBy('createdAt').reverse().toArray()
      if (!limit || limit <= 0) return rows
      return rows.slice(0, limit)
    },
    async start(data) {
      const session: FocusSession = withBase({
        status: 'active',
        plannedMinutes: data.plannedMinutes,
        taskId: data.taskId,
        goal: data.goal?.trim() || undefined,
      })
      await db.focusSessions.add(session)
      return session
    },
    async complete(id, data) {
      const existing = await db.focusSessions.get(id)
      if (!existing) return undefined
      const completedAt = data?.completedAt ?? Date.now()
      const actualMinutes =
        typeof data?.actualMinutes === 'number' ? data.actualMinutes : Math.max(1, Math.round((completedAt - existing.createdAt) / 60000))
      const next = touch({
        ...existing,
        status: 'completed' as const,
        actualMinutes,
        completedAt,
      })
      await db.focusSessions.put(next)
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
  habits: {
    async listHabits(userId, options = {}) {
      const archived = options.archived ?? false
      const rows = await db.habits.where('userId').equals(userId).toArray()
      const filtered = rows.filter((item) => item.archived === archived)
      return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    },
    async createHabit(data) {
      const rows = await db.habits.where('userId').equals(data.userId).toArray()
      const maxOrder = rows.reduce((max, item) => Math.max(max, item.sortOrder), -1)
      const habit: Habit = withBase({
        ...(data as Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>),
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : maxOrder + 1,
      })
      await db.habits.add(habit)
      return habit
    },
    async updateHabit(id, patch) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, ...(patch as Partial<Habit>) })
      await db.habits.put(next)
      return next
    },
    async archiveHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: true })
      await db.habits.put(next)
      return next
    },
    async restoreHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: false })
      await db.habits.put(next)
      return next
    },
    async reorderHabits(userId, ids) {
      if (!ids.length) return
      const rows = (await db.habits.where('userId').equals(userId).toArray()).filter((item) => !item.archived)
      const byId = new Map(rows.map((item) => [item.id, item]))
      const now = Date.now()
      const updated = ids
        .map((id, index) => {
          const existing = byId.get(id)
          if (!existing) return null
          return { ...existing, sortOrder: index, updatedAt: now }
        })
        .filter((item): item is Habit => Boolean(item))
      if (updated.length) await db.habits.bulkPut(updated)
    },
    async recordHabitCompletion(habitId, dateKey, value) {
      const habit = await db.habits.get(habitId)
      if (!habit) throw new Error('Habit not found')

      const existing = await db.habitLogs.where('[habitId+dateKey]').equals([habitId, dateKey]).first()
      const status: HabitStatus = 'completed'
      const log: HabitLog = existing
        ? touch({
            ...existing,
            status,
            value: typeof value === 'number' ? value : existing.value,
          })
        : withBase({
            userId: habit.userId,
            habitId,
            dateKey,
            value,
            status,
          })

      if (!existing && typeof value !== 'number' && habit.type !== 'boolean' && typeof habit.target === 'number') {
        log.value = habit.target
      }

      await db.habitLogs.put(log)
      return log
    },
    async undoHabitCompletion(habitId, dateKey) {
      const existing = await db.habitLogs.where('[habitId+dateKey]').equals([habitId, dateKey]).first()
      if (!existing) return
      await db.habitLogs.delete(existing.id)
    },
    async listHabitLogs(habitId) {
      const rows = await db.habitLogs.where('habitId').equals(habitId).toArray()
      return rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async computeHabitStreak(habitId, dateKey) {
      const habit = await db.habits.get(habitId)
      if (!habit) return 0
      const logs = await db.habitLogs.where('habitId').equals(habitId).toArray()
      const map = new Map(logs.map((item) => [item.dateKey, item]))
      const earliestDateKey = logs.length > 0 ? logs.reduce((min, item) => (item.dateKey < min ? item.dateKey : min), logs[0].dateKey) : null
      let streak = 0
      let cursor = dateKey
      let freezesLeft = Math.max(0, habit.freezesAllowed)

      for (let index = 0; index < 3650; index += 1) {
        const log = map.get(cursor)
        if (!log) {
          if (earliestDateKey && cursor < earliestDateKey) break
          if (freezesLeft <= 0) break
          freezesLeft -= 1
          streak += 1
          cursor = moveDateKey(cursor, -1)
          continue
        }

        if (log.status === 'completed' || log.status === 'frozen') {
          streak += 1
          if (log.status === 'frozen') freezesLeft = Math.max(0, freezesLeft - 1)
          cursor = moveDateKey(cursor, -1)
          continue
        }

        if (freezesLeft <= 0) break
        freezesLeft -= 1
        streak += 1
        cursor = moveDateKey(cursor, -1)
      }
      return streak
    },
    async getDailyProgress(userId, dateKey) {
      const habits = (await db.habits.where('userId').equals(userId).toArray()).filter((item) => !item.archived)
      if (!habits.length) return { completed: 0, total: 0, percent: 0 }
      const logs = (await db.habitLogs.where('userId').equals(userId).toArray()).filter((item) => item.dateKey === dateKey)
      const completedIds = new Set(logs.filter((item) => item.status === 'completed').map((item) => item.habitId))
      const completed = habits.filter((habit) => completedIds.has(habit.id)).length
      const percent = Math.round((completed / habits.length) * 100)
      return { completed, total: habits.length, percent }
    },
    async getHeatmap(userId, days) {
      const range = Math.max(1, days)
      const end = new Date()
      const first = new Date(end.getTime() - (range - 1) * MS_PER_DAY)
      const startKey = toDateKey(first)
      const endKey = toDateKey(end)
      const [habits, logs] = await Promise.all([
        db.habits
          .where('userId')
          .equals(userId)
          .toArray()
          .then((rows) => rows.filter((item) => !item.archived)),
        db.habitLogs
          .where('userId')
          .equals(userId)
          .toArray()
          .then((rows) => rows.filter((item) => item.dateKey >= startKey && item.dateKey <= endKey)),
      ])
      const total = habits.length
      const byDate = new Map<string, number>()
      for (const row of logs) {
        if (row.status !== 'completed') continue
        byDate.set(row.dateKey, (byDate.get(row.dateKey) ?? 0) + 1)
      }

      return Array.from({ length: range }).map((_, index) => {
        const key = toDateKey(new Date(first.getTime() + index * MS_PER_DAY))
        return { dateKey: key, completed: byDate.get(key) ?? 0, total }
      })
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
