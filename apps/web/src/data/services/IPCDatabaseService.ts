import type { IDatabaseService } from '@focus-go/core'
import type { IpcChannel, IpcRequestByChannel, IpcResponseByChannel } from '@focus-go/db-contracts'

export type ElectronDatabaseApi = {
  invokeDb: (channel: IpcChannel, payload?: unknown) => Promise<unknown>
}

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
    async appendProgress(id, content) {
      const response = await invokeDb(api, 'db:tasks:appendProgress', { id, content })
      return unwrapData(response)
    },
    async clearAllTags() {
      const response = await invokeDb(api, 'db:tasks:clearAllTags', {})
      unwrapData(response)
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
    async restoreByDate(dateKey) {
      const response = await invokeDb(api, 'db:diary:restoreByDate', { dateKey })
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
})
