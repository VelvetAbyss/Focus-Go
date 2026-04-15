import { createRxDatabase, type RxCollection } from 'rxdb'
import { replicateRxCollection } from 'rxdb/plugins/replication'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { db } from '../db'
import { createBlobMap, decodeSyncPayload, encodeSyncPayload } from './content'
import { SYNC_DATA_UPDATED_EVENT, SYNC_ENTITY_TABLES, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncApi } from './client'
import type { RxdbCheckpoint, SyncEntityType, SyncPayload, SyncState, SyncStatus } from './types'

const RXDB_SYNC_DB_NAME = 'focusgo-sync-rxdb'
const RXDB_SYNC_BATCH_SIZE = 100
const SYNC_ENTITY_TYPES = Object.keys(SYNC_ENTITY_TABLES) as SyncEntityType[]

type SyncDocument = SyncPayload & { _deleted?: boolean }

let rxdbQueue = Promise.resolve()

const now = () => Date.now()
const getCollectionName = (entityType: SyncEntityType) => `sync${entityType.toLowerCase()}`
const getDatabaseName = (entityType: SyncEntityType) => `${RXDB_SYNC_DB_NAME}-${entityType.toLowerCase()}`

const runQueued = async <T>(task: () => Promise<T>) => {
  const next = rxdbQueue.then(task, task)
  rxdbQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

const emitWindowEvent = (eventName: string) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(eventName))
}

const buildStatePatch = async (patch: Partial<SyncState>) => {
  const current = await db.syncState.get('cloud-sync')
  const timestamp = now()
  const next: SyncState = {
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
    ...current,
    ...patch,
    createdAt: current?.createdAt ?? timestamp,
    id: 'cloud-sync',
    updatedAt: timestamp,
  }
  await db.syncState.put(next)
  emitWindowEvent(SYNC_STATUS_CHANGED_EVENT)
  return next
}

const setStatus = async (status: SyncStatus, lastError: string | null = null) =>
  buildStatePatch({ status, lastError, pendingFirstSync: false, firstSyncResolved: true, migrationVersion: 3 })

const ensureSyncStateReady = async () =>
  buildStatePatch({ firstSyncResolved: true, pendingFirstSync: false, migrationVersion: 3, restoreIntegrityStatus: 'ready' })

const collectionSchema = {
  version: 0,
  type: 'object',
  primaryKey: 'id',
  additionalProperties: true,
  properties: {
    id: { type: 'string', maxLength: 200 },
    updatedAt: { type: 'number', minimum: 0, maximum: 9999999999999 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'updatedAt'],
} as const

const openCollection = async (entityType: SyncEntityType) => {
  const database = await createRxDatabase({
    name: getDatabaseName(entityType),
    storage: getRxStorageDexie(),
    multiInstance: false,
  })
  const collectionName = getCollectionName(entityType)
  const collections = await database.addCollections({
    [collectionName]: { schema: collectionSchema },
  } as never)
  return {
    database,
    collection: collections[collectionName] as RxCollection<SyncDocument>,
  }
}

const withCollection = async <T>(entityType: SyncEntityType, task: (collection: RxCollection<SyncDocument>) => Promise<T>) => {
  const { database, collection } = await openCollection(entityType)
  try {
    return await task(collection)
  } finally {
    await (database as any).destroy()
  }
}

const writeDexieEntity = async (entityType: SyncEntityType, document: SyncDocument) => {
  const tableName = SYNC_ENTITY_TABLES[entityType]
  const table = db.table(tableName)
  if (document._deleted) await table.delete(document.id)
  else await table.put({ ...document, _deleted: undefined })
  emitWindowEvent(SYNC_DATA_UPDATED_EVENT)
}

const seedCollectionFromDexie = async (entityType: SyncEntityType, collection: RxCollection<SyncDocument>) => {
  const count = await collection.count().exec()
  if (count > 0) return
  const rows = await db.table(SYNC_ENTITY_TABLES[entityType]).toArray()
  if (rows.length === 0) return
  await collection.bulkUpsert(rows.map((row) => ({ ...(row as SyncPayload), _deleted: false })))
}

const pullHandler = async (entityType: SyncEntityType, checkpoint: RxdbCheckpoint | undefined, batchSize: number) => {
  const response = await syncApi.rxdbPull({
    entityType,
    checkpoint: checkpoint ?? null,
    limit: batchSize,
  })
  const blobMap = createBlobMap(response.blobs)
  const documents = await Promise.all(
    response.documents.map(async (document) => {
      const decoded = await decodeSyncPayload(entityType, document, blobMap)
      return {
        ...(decoded as SyncPayload),
        _deleted: document._deleted === true,
      }
    }),
  )
  return {
    documents,
    checkpoint: response.checkpoint ?? undefined,
  }
}

const pushHandler = async (entityType: SyncEntityType, rows: any[]) => {
  const blobMap = new Map<string, Awaited<ReturnType<typeof encodeSyncPayload>>['blobs'][number]>()
  const encodedRows = await Promise.all(
    rows.map(async (row) => {
      const encodeState = async (state: any | null) => {
        if (!state) return null
        const base = { ...state }
        const isDeleted = base._deleted === true
        delete base._deleted
        if (isDeleted) return { payload: base, blobs: [] }
        const encoded = await encodeSyncPayload(entityType, base)
        for (const blob of encoded.blobs) blobMap.set(blob.hash, blob)
        return { payload: encoded.payload, blobs: encoded.blobs }
      }

      const nextState = await encodeState(row.newDocumentState)
      const assumedState = await encodeState(row.assumedMasterState)
      return {
        newDocumentState: {
          ...(nextState?.payload ?? row.newDocumentState),
          _deleted: row.newDocumentState._deleted === true,
        },
        assumedMasterState: assumedState
          ? {
              ...assumedState.payload,
              _deleted: row.assumedMasterState?._deleted === true,
            }
          : null,
      }
    }),
  )

  const response = await syncApi.rxdbPush({
    entityType,
    rows: encodedRows,
    blobs: Array.from(blobMap.values()),
  })
  const conflictBlobMap = createBlobMap(response.blobs)
  return Promise.all(
    response.conflicts.map(async (document) => {
      const decoded = await decodeSyncPayload(entityType, document, conflictBlobMap)
      return {
        ...(decoded as SyncPayload),
        _deleted: document._deleted === true,
      }
    }),
  )
}

const syncEntity = async (entityType: SyncEntityType) =>
  withCollection(entityType, async (collection) => {
    await seedCollectionFromDexie(entityType, collection)
    const replication = replicateRxCollection<SyncDocument, RxdbCheckpoint>({
      replicationIdentifier: `focusgo-${entityType}`,
      collection,
      deletedField: '_deleted',
      live: false,
      waitForLeadership: false,
      retryTime: 3_000,
      pull: {
        batchSize: RXDB_SYNC_BATCH_SIZE,
        handler: (checkpoint: RxdbCheckpoint | undefined, batchSize: number) => pullHandler(entityType, checkpoint, batchSize),
      },
      push: {
        batchSize: RXDB_SYNC_BATCH_SIZE,
        handler: (rows: any[]) => pushHandler(entityType, rows),
      },
    } as never)

    const receivedSub = replication.received$.subscribe({
      next: (document) => {
        void writeDexieEntity(entityType, document as SyncDocument)
        void buildStatePatch({ lastPulledAt: now(), missingBlobPull: false })
      },
    })
    const sentSub = replication.sent$.subscribe({
      next: () => {
        void buildStatePatch({ lastPushedAt: now() })
      },
    })
    const errorSub = replication.error$.subscribe({
      next: (error) => {
        const message = error instanceof Error ? error.message : 'Sync failed'
        void setStatus('error', message)
      },
    })

    try {
      await replication.awaitInSync()
    } finally {
      receivedSub.unsubscribe()
      sentSub.unsubscribe()
      errorSub.unsubscribe()
      await replication.cancel()
    }
  })

export const ensureRxdbSyncReady = async () =>
  runQueued(async () => {
    await ensureSyncStateReady()
  })

export const runRxdbSyncCycle = async () =>
  runQueued(async () => {
    await ensureSyncStateReady()
    await setStatus('syncing')
    try {
      for (const entityType of SYNC_ENTITY_TYPES) {
        await syncEntity(entityType)
      }
      await setStatus('idle')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed'
      await setStatus('error', message)
      throw error
    }
  })

export const enqueueRxdbSyncChange = async <T extends SyncEntityType>(
  entityType: T,
  op: 'upsert' | 'delete',
  payload: SyncPayload<T>,
) =>
  runQueued(async () => {
    await ensureSyncStateReady()
    await withCollection(entityType, async (collection) => {
      await seedCollectionFromDexie(entityType, collection)
      await collection.upsert({
        ...(payload as SyncPayload),
        _deleted: op === 'delete',
      })
    })
  })

export const reseedRxdbFromSnapshot = async (snapshot: { [K in SyncEntityType]: Array<SyncPayload<K>> }) =>
  runQueued(async () => {
    await resetRxdbSyncDatabase()
    for (const entityType of SYNC_ENTITY_TYPES) {
      await withCollection(entityType, async (collection) => {
        const rows = snapshot[entityType]
        if (rows.length === 0) return
        await collection.bulkUpsert(rows.map((row) => ({ ...row, _deleted: false })))
      })
    }
  })

export const resetRxdbSyncDatabase = async () =>
  runQueued(async () => {
    for (const entityType of SYNC_ENTITY_TYPES) {
      const database = await createRxDatabase({
        name: getDatabaseName(entityType),
        storage: getRxStorageDexie(),
        multiInstance: false,
      })
      await database.remove()
    }
  })
