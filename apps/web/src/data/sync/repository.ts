import { LOCAL_DATA_OWNER_KEY } from '../../store/authOwnership'
import { db } from '../db'
import { SYNC_ENTITY_TABLES, SYNC_STATE_ID, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { isLocalOnlyMode } from '../storageMode'
import type { SyncEntityType, SyncOp, SyncPayload, SyncState, SyncStatus } from './types'

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
    firstSyncResolved: true,
    pendingFirstSync: false,
    pendingEntityPush: false,
    pendingBlobPush: false,
    missingBlobPull: false,
    migrationVersion: 3,
    restoreIntegrityStatus: 'ready',
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
  async markStatus(status: SyncStatus, lastError: string | null = null) {
    return this.patch({ status, lastError })
  },
}

export const enqueueSyncOperation = async <T extends SyncEntityType>(
  entityType: T,
  op: SyncOp,
  payload: SyncPayload<T>,
  deletedAt?: number | null,
): Promise<void> => {
  // A local-only device has nowhere to replicate to. Bailing out *before* the
  // dynamic import keeps the entire RxDB engine — module, storage init and the
  // mirror collections it builds — out of the session, rather than filling an
  // outbox nobody will ever drain. Nothing is lost if the user later switches
  // to cloud: syncEntity() re-seeds every collection from Dexie at the start of
  // each cycle, so the existing local data is pushed on the first sync.
  if (isLocalOnlyMode()) return
  const { enqueueRxdbSyncChange } = await import('./rxdb')
  await enqueueRxdbSyncChange(entityType, op, payload, deletedAt)
}

const pendingSyncOperations = new Set<Promise<void>>()

export const drainPendingSyncOperations = async () => {
  while (pendingSyncOperations.size) await Promise.all([...pendingSyncOperations])
}

export const enqueueSyncOperationInBackground = <T extends SyncEntityType>(
  entityType: T,
  op: SyncOp,
  payload: SyncPayload<T>,
  deletedAt?: number | null,
) => {
  const pending = enqueueSyncOperation(entityType, op, payload, deletedAt).then(() => undefined).catch((error) => {
    console.error(`[sync] ${entityType}/${payload.id} enqueue failed`, error)
  })
  pendingSyncOperations.add(pending)
  void pending.then(() => pendingSyncOperations.delete(pending))
}

export const collectLocalSnapshot = async () => {
  const entries = await Promise.all(
    (Object.entries(SYNC_ENTITY_TABLES) as Array<[SyncEntityType, string]>).map(async ([entityType, tableName]) => {
      const rows = await db.table(tableName).toArray()
      return [entityType, rows] as const
    }),
  )
  return Object.fromEntries(entries) as { [K in SyncEntityType]: Array<SyncPayload<K>> }
}

export const seedOutboxFromSnapshot = async () => {
  const snapshot = await collectLocalSnapshot()
  const { reseedRxdbFromSnapshot } = await import('./rxdb')
  await reseedRxdbFromSnapshot(snapshot)
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

export const clearLocalUserData = async () => {
  await drainPendingSyncOperations()
  const { runRxdbMaintenance } = await import('./rxdb')
  await runRxdbMaintenance(async () => {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) await table.clear()
    })
  })
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LOCAL_DATA_OWNER_KEY)
}
