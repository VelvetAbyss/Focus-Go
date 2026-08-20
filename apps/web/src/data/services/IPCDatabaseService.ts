import type { IDatabaseService } from '@focus-go/core'
import type { IpcChannel, IpcRequestByChannel, IpcResponseByChannel } from '@focus-go/db-contracts'

export type ElectronDatabaseApi = {
  invokeDb: (channel: IpcChannel, payload?: unknown) => Promise<unknown>
}
const NOTE_TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

const unwrapData = <T>(response: unknown): T => {
  const typed = response as { ok: boolean; data?: unknown; error?: { message?: string } }
  if (!typed.ok) {
    throw new Error(typed.error?.message ?? 'IPC request failed')
  }
  return typed.data as T
}

const invokeDb = async <C extends IpcChannel>(
  api: ElectronDatabaseApi,
  channel: C,
  payload: IpcRequestByChannel[C]
): Promise<IpcResponseByChannel[C]> => {
  const response = await api.invokeDb(channel, payload)
  return response as IpcResponseByChannel[C]
}

export const createIPCDatabaseService = (api: ElectronDatabaseApi): IDatabaseService => ({
  tasks: {
    async list() {
      const response = await invokeDb(api, 'db:tasks:list', {})
      return unwrapData(response)
    },
    async add(data) {
      const response = await invokeDb(api, 'db:tasks:add', data)
      return unwrapData(response)
    },
    async update(task) {
      const response = await invokeDb(api, 'db:tasks:update', { task })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:tasks:remove', { id })
      unwrapData(response)
    },
    async updateStatus(id, status) {
      const response = await invokeDb(api, 'db:tasks:updateStatus', { id, status })
      return unwrapData(response)
    },
    async clearAllTags() {
      const response = await invokeDb(api, 'db:tasks:clearAllTags', {})
      unwrapData(response)
    },
  },
  notes: {
    async list() {
      const trashResponse = await invokeDb(api, 'db:notes:listTrash', {})
      const trash = unwrapData<Array<{ id: string; deletedAt?: number | null }>>(trashResponse)
      const threshold = Date.now() - NOTE_TRASH_RETENTION_MS
      const expired = trash.filter((item) => typeof item.deletedAt === 'number' && item.deletedAt > 0 && item.deletedAt < threshold)
      if (expired.length > 0) {
        await Promise.all(expired.map((item) => invokeDb(api, 'db:notes:hardDelete', { id: item.id })))
      }
      const response = await invokeDb(api, 'db:notes:list', {})
      return unwrapData(response)
    },
    async listTrash() {
      const trashResponse = await invokeDb(api, 'db:notes:listTrash', {})
      const trash = unwrapData<Array<{ id: string; deletedAt?: number | null }>>(trashResponse)
      const threshold = Date.now() - NOTE_TRASH_RETENTION_MS
      const expired = trash.filter((item) => typeof item.deletedAt === 'number' && item.deletedAt > 0 && item.deletedAt < threshold)
      if (expired.length > 0) {
        await Promise.all(expired.map((item) => invokeDb(api, 'db:notes:hardDelete', { id: item.id })))
      }
      const response = await invokeDb(api, 'db:notes:listTrash', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:notes:create', data ?? {})
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:notes:update', { id, patch })
      return unwrapData(response)
    },
    async softDelete(id) {
      const response = await invokeDb(api, 'db:notes:softDelete', { id })
      return unwrapData(response)
    },
    async restore(id) {
      const response = await invokeDb(api, 'db:notes:restore', { id })
      return unwrapData(response)
    },
    async hardDelete(id) {
      const response = await invokeDb(api, 'db:notes:hardDelete', { id })
      unwrapData(response)
    },
  },
  noteTags: {
    async list() {
      const response = await invokeDb(api, 'db:noteTags:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:noteTags:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:noteTags:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:noteTags:remove', { id })
      unwrapData(response)
    },
  },
  noteAppearance: {
    async get() {
      const response = await invokeDb(api, 'db:noteAppearance:get', {})
      return unwrapData(response)
    },
    async upsert(data) {
      const response = await invokeDb(api, 'db:noteAppearance:upsert', data)
      return unwrapData(response)
    },
  },
  widgetTodos: {
    async list(scope) {
      const response = await invokeDb(api, 'db:widgetTodos:list', { scope })
      return unwrapData(response)
    },
    async add(data) {
      const response = await invokeDb(api, 'db:widgetTodos:add', data)
      return unwrapData(response)
    },
    async update(item) {
      const response = await invokeDb(api, 'db:widgetTodos:update', { item })
      return unwrapData(response)
    },
    async resetDone(scope) {
      const response = await invokeDb(api, 'db:widgetTodos:resetDone', { scope })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:widgetTodos:remove', { id })
      unwrapData(response)
    },
  },
  focus: {
    async get() {
      const response = await invokeDb(api, 'db:focus:get', {})
      return unwrapData(response)
    },
    async upsert(data) {
      const response = await invokeDb(api, 'db:focus:upsert', data)
      return unwrapData(response)
    },
  },
  focusSessions: {
    async list(limit) {
      const response = await invokeDb(api, 'db:focusSessions:list', { limit })
      return unwrapData(response)
    },
    async start(data) {
      const response = await invokeDb(api, 'db:focusSessions:start', data)
      return unwrapData(response)
    },
    async complete(id, data) {
      const response = await invokeDb(api, 'db:focusSessions:complete', { id, ...(data ?? {}) })
      return unwrapData(response)
    },
  },
  diary: {
    async list() {
      const response = await invokeDb(api, 'db:diary:list', {})
      return unwrapData(response)
    },
    async listActive() {
      const response = await invokeDb(api, 'db:diary:listActive', {})
      return unwrapData(response)
    },
    async getByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:getByDate', { dateKey })
      return unwrapData(response)
    },
    async listByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:listByDate', { dateKey })
      return unwrapData(response)
    },
    async listByRange(dateFrom, dateTo, options = {}) {
      const response = await invokeDb(api, 'db:diary:listByRange', { dateFrom, dateTo, options })
      return unwrapData(response)
    },
    async listTrash() {
      const response = await invokeDb(api, 'db:diary:listTrash', {})
      return unwrapData(response)
    },
    async softDeleteByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:softDeleteByDate', { dateKey })
      return unwrapData(response)
    },
    async softDeleteById(id) {
      const response = await invokeDb(api, 'db:diary:softDeleteById', { id })
      return unwrapData(response)
    },
    async restoreByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:restoreByDate', { dateKey })
      return unwrapData(response)
    },
    async restoreById(id) {
      const response = await invokeDb(api, 'db:diary:restoreById', { id })
      return unwrapData(response)
    },
    async markExpiredOlderThan(days) {
      const response = await invokeDb(api, 'db:diary:markExpiredOlderThan', { days })
      return unwrapData(response)
    },
    async hardDeleteByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:hardDeleteByDate', { dateKey })
      return unwrapData(response)
    },
    async hardDeleteById(id) {
      const response = await invokeDb(api, 'db:diary:hardDeleteById', { id })
      return unwrapData(response)
    },
    async add(data) {
      const response = await invokeDb(api, 'db:diary:add', data)
      return unwrapData(response)
    },
    async update(entry) {
      const response = await invokeDb(api, 'db:diary:update', { entry })
      return unwrapData(response)
    },
  },
  spend: {
    async listEntries() {
      const response = await invokeDb(api, 'db:spend:listEntries', {})
      return unwrapData(response)
    },
    async addEntry(data) {
      const response = await invokeDb(api, 'db:spend:addEntry', data)
      return unwrapData(response)
    },
    async deleteEntry(id) {
      const response = await invokeDb(api, 'db:spend:deleteEntry', { id })
      unwrapData(response)
    },
    async updateEntry(entry) {
      const response = await invokeDb(api, 'db:spend:updateEntry', { entry })
      return unwrapData(response)
    },
    async listCategories() {
      const response = await invokeDb(api, 'db:spend:listCategories', {})
      return unwrapData(response)
    },
    async addCategory(data) {
      const response = await invokeDb(api, 'db:spend:addCategory', data)
      return unwrapData(response)
    },
    async updateCategory(category) {
      const response = await invokeDb(api, 'db:spend:updateCategory', { category })
      return unwrapData(response)
    },
  },
  dashboard: {
    async get() {
      const response = await invokeDb(api, 'db:dashboard:get', {})
      return unwrapData(response)
    },
    async upsert(data) {
      const response = await invokeDb(api, 'db:dashboard:upsert', data)
      return unwrapData(response)
    },
  },
  lifeDashboard: {
    async get() {
      const response = await invokeDb(api, 'db:lifeDashboard:get', {})
      return unwrapData(response)
    },
    async upsert(data) {
      const response = await invokeDb(api, 'db:lifeDashboard:upsert', data)
      return unwrapData(response)
    },
  },
  books: {
    async list() {
      const response = await invokeDb(api, 'db:books:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:books:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:books:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:books:remove', { id })
      unwrapData(response)
    },
  },
  media: {
    async list() {
      const response = await invokeDb(api, 'db:media:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:media:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:media:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:media:remove', { id })
      unwrapData(response)
    },
  },
  stocks: {
    async list() {
      const response = await invokeDb(api, 'db:stocks:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:stocks:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:stocks:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:stocks:remove', { id })
      unwrapData(response)
    },
  },
  lifeSubscriptions: {
    async list() {
      const response = await invokeDb(api, 'db:lifeSubscriptions:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:lifeSubscriptions:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:lifeSubscriptions:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:lifeSubscriptions:remove', { id })
      unwrapData(response)
    },
  },
  lifePodcasts: {
    async list() {
      const response = await invokeDb(api, 'db:lifePodcasts:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:lifePodcasts:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:lifePodcasts:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:lifePodcasts:remove', { id })
      unwrapData(response)
    },
  },
  lifePeople: {
    async list() {
      const response = await invokeDb(api, 'db:lifePeople:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:lifePeople:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:lifePeople:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:lifePeople:remove', { id })
      unwrapData(response)
    },
  },
  trips: {
    async list() {
      const response = await invokeDb(api, 'db:trips:list', {})
      return unwrapData(response)
    },
    async create(data) {
      const response = await invokeDb(api, 'db:trips:create', data)
      return unwrapData(response)
    },
    async update(id, patch) {
      const response = await invokeDb(api, 'db:trips:update', { id, patch })
      return unwrapData(response)
    },
    async remove(id) {
      const response = await invokeDb(api, 'db:trips:remove', { id })
      unwrapData(response)
    },
  },
  habits: {
    async listHabits(userId, options) {
      const response = await invokeDb(api, 'db:habits:list', { userId, options })
      return unwrapData(response)
    },
    async createHabit(data) {
      const response = await invokeDb(api, 'db:habits:create', data)
      return unwrapData(response)
    },
    async updateHabit(id, patch) {
      const response = await invokeDb(api, 'db:habits:update', { id, patch })
      return unwrapData(response)
    },
    async archiveHabit(id) {
      const response = await invokeDb(api, 'db:habits:archive', { id })
      return unwrapData(response)
    },
    async restoreHabit(id) {
      const response = await invokeDb(api, 'db:habits:restore', { id })
      return unwrapData(response)
    },
    async reorderHabits(userId, ids) {
      const response = await invokeDb(api, 'db:habits:reorder', { userId, ids })
      unwrapData(response)
    },
    async recordHabitCompletion(habitId, dateKey, value) {
      const response = await invokeDb(api, 'db:habits:recordCompletion', { habitId, dateKey, value })
      return unwrapData(response)
    },
    async undoHabitCompletion(habitId, dateKey) {
      const response = await invokeDb(api, 'db:habits:undoCompletion', { habitId, dateKey })
      unwrapData(response)
    },
    async listHabitLogs(habitId) {
      const response = await invokeDb(api, 'db:habits:listLogs', { habitId })
      return unwrapData(response)
    },
    async computeHabitStreak(habitId, dateKey) {
      const response = await invokeDb(api, 'db:habits:computeStreak', { habitId, dateKey })
      return unwrapData(response)
    },
    async getDailyProgress(userId, dateKey) {
      const response = await invokeDb(api, 'db:habits:getDailyProgress', { userId, dateKey })
      return unwrapData(response)
    },
    async getHeatmap(userId, days) {
      const response = await invokeDb(api, 'db:habits:getHeatmap', { userId, days })
      return unwrapData(response)
    },
  },
})
