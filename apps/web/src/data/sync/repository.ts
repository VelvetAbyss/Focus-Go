import { db } from '../db'
import { createBlobMap, decodeSyncPayload } from './content'
import { SYNC_ENTITY_TABLES, SYNC_OUTBOX_CHANGED_EVENT, SYNC_STATE_ID, SYNC_STATUS_CHANGED_EVENT } from './constants'
import type { SyncEntityType, SyncOutboxItem, SyncPayload, SyncRemoteRow, SyncState, SyncStatus, SyncWireResponse } from './types'

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
    pendingEntityPush: false,
    pendingBlobPush: false,
    missingBlobPull: false,
    migrationVersion: 2,
    restoreIntegrityStatus: 'idle',
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
      pendingEntityPush: false,
      pendingBlobPush: false,
      missingBlobPull: false,
      restoreIntegrityStatus: 'ready',
      pendingLocalRecordCount: 0,
      pendingRemoteRecordCount: 0,
      status: 'idle',
    })
  },
  async markChoice() {
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
  async markRetry(ids: string[]) {
    if (!ids.length) return
    const rows = await db.syncOutbox.bulkGet(ids)
    const timestamp = now()
    await db.syncOutbox.bulkPut(
      rows.filter((item): item is SyncOutboxItem => Boolean(item)).map((item) => {
        const nextAttempt = item.attemptCount + 1
        const delay = Math.min(60_000, nextAttempt * 5_000)
        return {
          ...item,
          attemptCount: nextAttempt,
          nextRetryAt: timestamp + delay,
        }
      }),
    )
    emitWindowEvent(SYNC_OUTBOX_CHANGED_EVENT)
  },
}

export const enqueueSyncOperation = syncOutboxRepo.enqueue.bind(syncOutboxRepo)

export const getLocalEntityCount = async () => {
  const counts = await Promise.all(Object.values(SYNC_ENTITY_TABLES).map((tableName) => db.table(tableName).count()))
  return counts.reduce((sum, count) => sum + count, 0)
}

export const getRemoteEntityCount = (bootstrap: SyncWireResponse) =>
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

export const applyRemoteTables = async (tables: SyncWireResponse['tables'], blobs: SyncWireResponse['blobs']) => {
  const tableObjects = Object.values(SYNC_ENTITY_TABLES).map((name) => db.table(name))
  const blobMap = createBlobMap(blobs)
  await db.transaction('rw', tableObjects, async () => {
    for (const [entityType, tableName] of Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>) {
      const table = db.table(tableName)
      const rows = tables[entityType] ?? []
      for (const row of rows) {
        const current = await table.get(row.id)
        if (!shouldReplace(current as { updatedAt?: number; deletedAt?: number | null } | undefined, row)) continue
        if (row.deletedAt) await table.delete(row.id)
        else await table.put(await decodeSyncPayload(entityType, row.payload, blobMap))
      }
    }
  })
}

export const replaceLocalWithRemote = async (tables: SyncWireResponse['tables'], blobs: SyncWireResponse['blobs']) => {
  // Build table list dynamically so any new entity type added to SYNC_ENTITY_TABLES
  // is automatically included in the transaction without manual updates here.
  const tableObjects = Object.values(SYNC_ENTITY_TABLES).map((name) => db.table(name))
  const blobMap = createBlobMap(blobs)
  await db.transaction('rw', tableObjects, async () => {
    for (const [entityType, tableName] of Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>) {
      const table = db.table(tableName)
      await table.clear()
      const rows = await Promise.all(
        (tables[entityType] ?? [])
          .filter((row) => !row.deletedAt)
          .map((row) => decodeSyncPayload(entityType, row.payload, blobMap)),
      )
      if (rows.length) await table.bulkPut(rows)
    }
  })
}

export const seedOutboxFromSnapshot = async () => {
  const snapshot = await collectLocalSnapshot()
  for (const entityType of Object.keys(snapshot) as SyncEntityType[]) {
    for (const row of snapshot[entityType]) {
      await syncOutboxRepo.enqueue(entityType, 'upsert', row)
    }
  }
}

export const restampLocalSnapshotForRestore = async () => {
  const tableObjects = Object.values(SYNC_ENTITY_TABLES).map((name) => db.table(name))
  let timestamp = Date.now()
  await db.transaction('rw', tableObjects, async () => {
    for (const tableName of Object.values(SYNC_ENTITY_TABLES)) {
      const table = db.table(tableName)
      const rows = await table.toArray()
      if (rows.length === 0) continue
      const nextRows = rows.map((row) => ({
        ...(row as Record<string, unknown>),
        updatedAt: ++timestamp,
      }))
      await table.bulkPut(nextRows)
    }
  })
}

/**
 * Wipes all local user data from IndexedDB: every entity table, the sync
 * outbox, and the sync state. Call this on logout so the next login starts
 * with a clean slate and pulls fresh data from the cloud.
 */
export const clearLocalUserData = async () => {
  const entityTableObjects = Object.values(SYNC_ENTITY_TABLES).map((name) => db.table(name))
  await db.transaction('rw', [...entityTableObjects, db.syncOutbox, db.syncState, db.syncBlobCache], async () => {
    for (const tableName of Object.values(SYNC_ENTITY_TABLES)) {
      await db.table(tableName).clear()
    }
    await db.syncOutbox.clear()
    await db.syncState.clear()
    await db.syncBlobCache.clear()
  })
}
