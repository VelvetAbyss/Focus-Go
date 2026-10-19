import Dexie from 'dexie'
import { getAuth } from '../../store/auth'
import { suppressSyncCapture } from './capture'
import { persistPendingSyncChange } from './pendingChanges'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'
import { db } from '../db'
import { SYNC_ENTITY_TABLES, SYNC_STATE_ID, SYNC_STATUS_CHANGED_EVENT } from './constants'
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

export const requestSyncHandoff = () => {
  const flush = () => {
    void import('./rxdb').then(({ flushPendingSyncChanges }) => flushPendingSyncChanges()).catch((error) => {
      console.error('[sync] local handoff failed; retained for retry', error)
    })
  }
  const transaction = Dexie.currentTransaction
  if (transaction) transaction.on('complete', flush)
  else flush()
}

export const enqueueSyncOperation = async <T extends SyncEntityType>(
  entityType: T,
  op: SyncOp,
  payload: SyncPayload<T>,
  deletedAt?: number | null,
) => {
  await persistPendingSyncChange(entityType, op, payload, deletedAt)
  requestSyncHandoff()
}

export const enqueueSyncOperationInBackground = <T extends SyncEntityType>(
  entityType: T,
  op: SyncOp,
  payload: SyncPayload<T>,
  deletedAt?: number | null,
) => {
  void enqueueSyncOperation(entityType, op, payload, deletedAt).catch((error) => {
    console.error(`[sync] ${entityType}/${payload.id} enqueue failed`, error)
  })
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
  const authOwner = getAuth()?.user?.id
  const symbolicOwner = typeof authOwner === 'string' && authOwner ? authOwner : null
  // The account menu closes this connection through requestCrossTabDbReset first.
  if (!db.isOpen()) await db.open()
  const entityTableObjects = Object.values(SYNC_ENTITY_TABLES).map((name) => db.table(name))
  await db.transaction('rw', [...entityTableObjects, db.syncState, db.syncBlobCache, db.taskTrash, db.pendingSyncChanges, db.localSymbolic], async () => {
    suppressSyncCapture()
    for (const tableName of Object.values(SYNC_ENTITY_TABLES)) {
      await db.table(tableName).clear()
    }
    await db.syncState.clear()
    await db.syncBlobCache.clear()
    await db.pendingSyncChanges.clear()
    // Deleted tasks belong to the account too.
    await db.taskTrash.clear()
    if (symbolicOwner) await db.localSymbolic.where('ownerId').equals(symbolicOwner).delete()
  })
  if (symbolicOwner) {
    const { clearAstrologySelection } = await import('../../features/astrology/useAstrologySelection')
    clearAstrologySelection(symbolicOwner)
  }
  const { resetRxdbSyncDatabase } = await import('./rxdb')
  await resetRxdbSyncDatabase()
  localStorage.removeItem(LOCAL_ACCOUNT_OWNER_KEY)
}
