import { db } from '../db'
import { SYNC_ENTITY_TABLES, SYNC_OUTBOX_CHANGED_EVENT, SYNC_STATE_ID, SYNC_STATUS_CHANGED_EVENT } from './constants'
import type { FirstSyncChoice, SyncBootstrapResponse, SyncEntityType, SyncOutboxItem, SyncPayload, SyncRemoteRow, SyncState, SyncStatus } from './types'

const now = () => Date.now()

const emitWindowEvent = (eventName: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(eventName))
}

const buildInitialState = (): SyncState => {
  const timestamp = now()
  return {
    id: SYNC_STATE_ID,
    status: 'idle',
    lastPulledAt: null,
    lastPushedAt: null,
    lastError: null,
    firstSyncResolved: false,
    pendingFirstSync: false,
    pendingLocalRecordCount: 0,
    pendingRemoteRecordCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const syncStateRepo = {
  async get(): Promise<SyncState> {
    const current = await db.syncState.get(SYNC_STATE_ID)
    if (current) return current
    const created = buildInitialState()
    await db.syncState.put(created)
    return created
  },
  async patch(patch: Partial<SyncState>): Promise<SyncState> {
    const current = await this.get()
    const next: SyncState = {
      ...current,
      ...patch,
      id: SYNC_STATE_ID,
      updatedAt: now(),
    }
    await db.syncState.put(next)
    emitWindowEvent(SYNC_STATUS_CHANGED_EVENT)
    return next
  },
  async markPendingFirstSync(localCount: number, remoteCount: number) {
    return this.patch({
      status: 'blocked',
      pendingFirstSync: true,
      pendingLocalRecordCount: localCount,
      pendingRemoteRecordCount: remoteCount,
      lastError: null,
    })
  },
  async resolveFirstSync() {
    return this.patch({
      firstSyncResolved: true,
      pendingFirstSync: false,
      pendingLocalRecordCount: 0,
      pendingRemoteRecordCount: 0,
      status: 'idle',
    })
  },
  async markChoice(_choice: FirstSyncChoice) {
    return this.resolveFirstSync()
  },
  async markStatus(status: SyncStatus, lastError: string | null = null) {
    return this.patch({ status, lastError })
  },
}

export const syncOutboxRepo = {
  async listReady(referenceTime = now()) {
    const rows = await db.syncOutbox.orderBy('updatedAt').toArray()
    return rows.filter((item) => item.nextRetryAt <= referenceTime)
  },
  async listAll() {
    return db.syncOutbox.orderBy('updatedAt').toArray()
  },
  async enqueue<T extends SyncEntityType>(entityType: T, op: SyncOutboxItem<T>['op'], payload: SyncPayload<T>, deletedAt?: number | null) {
    const item: SyncOutboxItem<T> = {
      id: `${entityType}:${payload.id}`,
      entityType,
      entityId: payload.id,
      op,
      payload,
      updatedAt: payload.updatedAt,
      deletedAt: deletedAt ?? null,
      attemptCount: 0,
      nextRetryAt: 0,
      createdAt: now(),
    }
    await db.syncOutbox.put(item)
    emitWindowEvent(SYNC_OUTBOX_CHANGED_EVENT)
    return item
  },
  async remove(ids: string[]) {
    if (!ids.length) return
    await db.syncOutbox.bulkDelete(ids)
    emitWindowEvent(SYNC_OUTBOX_CHANGED_EVENT)
  },
  async markRetry(ids: string[], attemptCount: number) {
    if (!ids.length) return
    const rows = await db.syncOutbox.bulkGet(ids)
    const delay = Math.min(60_000, attemptCount * 5_000)
    const timestamp = now()
    await db.syncOutbox.bulkPut(
      rows.filter((item): item is SyncOutboxItem => Boolean(item)).map((item) => ({
        ...item,
        attemptCount,
        nextRetryAt: timestamp + delay,
      })),
    )
    emitWindowEvent(SYNC_OUTBOX_CHANGED_EVENT)
  },
}

export const enqueueSyncOperation = syncOutboxRepo.enqueue.bind(syncOutboxRepo)

export const getLocalEntityCount = async () => {
  const counts = await Promise.all(Object.values(SYNC_ENTITY_TABLES).map((tableName) => db.table(tableName).count()))
  return counts.reduce((sum, count) => sum + count, 0)
}

export const getRemoteEntityCount = (bootstrap: SyncBootstrapResponse) =>
  Object.values(bootstrap.tables).reduce((sum, rows) => sum + rows.length, 0)

export const collectLocalSnapshot = async () => {
  const entries = await Promise.all(
    (Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>).map(async ([entityType, tableName]) => {
      const rows = await db.table(tableName).toArray()
      return [entityType, rows] as const
    }),
  )
  return Object.fromEntries(entries) as { [K in SyncEntityType]: Array<SyncPayload<K>> }
}

const shouldReplace = (current: { updatedAt?: number; deletedAt?: number | null } | undefined, incoming: SyncRemoteRow) => {
  const currentUpdatedAt = current?.updatedAt ?? -1
  if (incoming.updatedAt > currentUpdatedAt) return true
  if (incoming.updatedAt < currentUpdatedAt) return false
  return (incoming.deletedAt ?? 0) > (current?.deletedAt ?? 0)
}

export const applyRemoteTables = async (tables: SyncBootstrapResponse['tables']) => {
  for (const [entityType, tableName] of Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>) {
    const table = db.table(tableName)
    const rows = tables[entityType] ?? []
    for (const row of rows) {
      const current = await table.get(row.id)
      if (!shouldReplace(current as { updatedAt?: number; deletedAt?: number | null } | undefined, row)) continue
      if (row.deletedAt) await table.delete(row.id)
      else await table.put(row.payload)
    }
  }
}

export const replaceLocalWithRemote = async (tables: SyncBootstrapResponse['tables']) => {
  await db.transaction(
    'rw',
    [
      db.tasks,
      db.notes,
      db.noteTags,
      db.noteAppearance,
      db.widgetTodos,
      db.focusSettings,
      db.focusSessions,
      db.diaryEntries,
      db.spends,
      db.spendCategories,
      db.dashboardLayout,
      db.userSubscriptions,
      db.featureInstallations,
      db.habits,
      db.habitLogs,
    ],
    async () => {
      for (const [entityType, tableName] of Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>) {
        const table = db.table(tableName)
        await table.clear()
        const rows = tables[entityType].filter((row) => !row.deletedAt).map((row) => row.payload)
        if (rows.length) await table.bulkPut(rows)
      }
    },
  )
}

export const seedOutboxFromSnapshot = async () => {
  const snapshot = await collectLocalSnapshot()
  for (const entityType of Object.keys(snapshot) as SyncEntityType[]) {
    for (const row of snapshot[entityType]) {
      await syncOutboxRepo.enqueue(entityType, 'upsert', row)
    }
  }
}
