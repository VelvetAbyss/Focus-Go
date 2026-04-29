import { createRxDatabase, type RxCollection } from 'rxdb'
import { replicateRxCollection } from 'rxdb/plugins/replication'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { db } from '../db'
import { createBlobMap, decodeSyncPayload, encodeSyncPayload } from './content'
import { dispatchSyncDataUpdated, SYNC_ENTITY_TABLES, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncApi } from './client'
import { getAuth } from '../../store/auth'
import type { RxdbCheckpoint, RxdbPullDocument, RxdbPushRow, SyncEntityType, SyncPayload, SyncState, SyncStatus } from './types'

const RXDB_SYNC_DB_NAME = 'focusgo-sync-rxdb'
const RXDB_SYNC_BATCH_SIZE = 100
const RXDB_SYNC_TIMEOUT_MS = 8_000
const RXDB_SYNC_PARALLEL_LIMIT = 6
const SYNC_ENTITY_TYPES = Object.keys(SYNC_ENTITY_TABLES) as SyncEntityType[]

type SyncDocument = RxdbPullDocument

let rxdbQueue = Promise.resolve()
let syncValidationErrors: string[] = []

const now = () => Date.now()
const getCollectionName = (entityType: SyncEntityType) => `sync${entityType.toLowerCase()}`
const getDatabaseName = (entityType: SyncEntityType) => `${RXDB_SYNC_DB_NAME}-${entityType.toLowerCase()}`

export const extractSyncErrorMessage = (error: unknown) => {
  const nestedErrors = (error as { parameters?: { errors?: Array<{ message?: string }> } })?.parameters?.errors
  const nestedMessage = nestedErrors?.find((item) => typeof item?.message === 'string' && item.message.trim())?.message?.trim()
  if (nestedMessage) return nestedMessage
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Sync failed'
}

const runQueued = async <T>(task: () => Promise<T>) => {
  const next = rxdbQueue.then(task, task)
  rxdbQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

const timeoutAfter = (ms: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms))

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
    closeDuplicates: true,
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

const closeDatabase = async (database: unknown) => {
  if (database && typeof (database as { close?: () => Promise<void> }).close === 'function') {
    await (database as { close: () => Promise<void> }).close()
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const describeSyncDocument = (entityType: SyncEntityType, document: unknown) => {
  const id = isRecord(document) && typeof document.id === 'string' ? document.id : 'unknown'
  return `${entityType}/${id}`
}

const normalizeSyncDocument = (entityType: SyncEntityType, document: unknown, source: string): SyncDocument => {
  if (!isRecord(document)) throw new Error(`${source} returned invalid ${entityType} payload`)
  if (typeof document.id !== 'string' || document.id.trim().length === 0) {
    throw new Error(`${source} returned ${entityType} payload without id`)
  }
  if (typeof document.updatedAt !== 'number' || !Number.isFinite(document.updatedAt) || document.updatedAt < 0) {
    throw new Error(`${source} returned invalid updatedAt for ${describeSyncDocument(entityType, document)}`)
  }
  if (document._deleted === true) {
    const deletedAt = typeof document.deletedAt === 'number' && Number.isFinite(document.deletedAt)
      ? document.deletedAt
      : document.updatedAt
    return { ...document, _deleted: true, deletedAt } as SyncDocument
  }
  return { ...document, _deleted: false } as SyncDocument
}

const withCollection = async <T>(entityType: SyncEntityType, task: (collection: RxCollection<SyncDocument>) => Promise<T>) => {
  const { database, collection } = await openCollection(entityType)
  try {
    return await task(collection)
  } finally {
    await closeDatabase(database)
  }
}

const writeDexieEntity = async (entityType: SyncEntityType, document: SyncDocument) => {
  const normalized = normalizeSyncDocument(entityType, document, 'pull')
  const tableName = SYNC_ENTITY_TABLES[entityType]
  const table = db.table(tableName)
  if (normalized._deleted) await table.delete(normalized.id)
  else await table.put({ ...normalized, _deleted: undefined })
  dispatchSyncDataUpdated(entityType)
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
  const documents: SyncDocument[] = []
  await Promise.all(
    response.documents.map(async (document) => {
      try {
        const decoded = await decodeSyncPayload(entityType, document, blobMap)
        documents.push(normalizeSyncDocument(entityType, {
          ...(decoded as SyncPayload),
          _deleted: document._deleted === true,
          deletedAt: document.deletedAt,
        }, 'pull'))
      } catch (error) {
        syncValidationErrors.push(`${entityType}: ${extractSyncErrorMessage(error)}`)
      }
    }),
  )
  return {
    documents,
    checkpoint: response.checkpoint ?? undefined,
  }
}

const pushHandler = async (entityType: SyncEntityType, rows: Array<RxdbPushRow>) => {
  const blobMap = new Map<string, Awaited<ReturnType<typeof encodeSyncPayload>>['blobs'][number]>()
  const encodedRows: Array<RxdbPushRow> = await Promise.all(
    rows.map(async (row) => {
      const encodeState = async (state: RxdbPullDocument | null) => {
        if (!state) return null
        const base = normalizeSyncDocument(entityType, state, 'push')
        const isDeleted = base._deleted === true
        const payload = { ...base, _deleted: undefined } as SyncPayload
        if (isDeleted) return { payload, blobs: [] }
        const encoded = await encodeSyncPayload(entityType, payload)
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
  const conflicts: SyncDocument[] = []
  await Promise.all(
    response.conflicts.map(async (document) => {
      try {
        const decoded = await decodeSyncPayload(entityType, document, conflictBlobMap)
        conflicts.push(normalizeSyncDocument(entityType, {
          ...(decoded as SyncPayload),
          _deleted: document._deleted === true,
          deletedAt: document.deletedAt,
        }, 'conflict'))
      } catch (error) {
        syncValidationErrors.push(`${entityType}: ${extractSyncErrorMessage(error)}`)
      }
    }),
  )
  return conflicts
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
      // Last-write-wins: whichever side has the more recent updatedAt timestamp wins.
      conflictHandler: async (input: { newDocumentState: SyncDocument; realMasterState: SyncDocument }) => {
        const local = input.newDocumentState
        const remote = input.realMasterState
        if (local.updatedAt === remote.updatedAt) {
          return { isEqual: true, documentData: local }
        }
        return {
          isEqual: false,
          documentData: local.updatedAt > remote.updatedAt ? local : remote,
        }
      },
      pull: {
        batchSize: RXDB_SYNC_BATCH_SIZE,
        handler: (checkpoint: RxdbCheckpoint | undefined, batchSize: number) => pullHandler(entityType, checkpoint, batchSize),
      },
      push: {
        batchSize: RXDB_SYNC_BATCH_SIZE,
        handler: (rows: Array<RxdbPushRow>) => pushHandler(entityType, rows),
      },
    } as never)

    const pendingWrites: Promise<unknown>[] = []
    let receivedDocumentCount = 0
    const receivedSub = replication.received$.subscribe({
      next: (document) => {
        receivedDocumentCount++
        pendingWrites.push(writeDexieEntity(entityType, document as SyncDocument))
      },
    })
    const sentSub = replication.sent$.subscribe({
      next: () => {
        void buildStatePatch({ lastPushedAt: now() })
      },
    })
    let rejectSync: ((reason?: unknown) => void) | null = null
    const errorPromise = new Promise<never>((_, reject) => {
      rejectSync = reject
    })
    const errorSub = replication.error$.subscribe({
      next: (error) => {
        rejectSync?.(error)
      },
    })
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = globalThis.setTimeout(() => reject(new Error(`Sync timed out for ${entityType}`)), RXDB_SYNC_TIMEOUT_MS)
    })

    try {
      await Promise.race([
        replication.awaitInSync(),
        errorPromise,
        timeoutPromise,
      ])
    } finally {
      if (timeoutId) globalThis.clearTimeout(timeoutId)
      receivedSub.unsubscribe()
      sentSub.unsubscribe()
      errorSub.unsubscribe()
      // Flush Dexie writes with a safety timeout — guards against db.close() leaving ops hanging
      await Promise.race([
        Promise.allSettled(pendingWrites),
        new Promise<void>(resolve => globalThis.setTimeout(resolve, 5_000)),
      ])
      if (receivedDocumentCount > 0) {
        await buildStatePatch({ lastPulledAt: now(), missingBlobPull: false }).catch(() => {})
      }
      await Promise.race([replication.cancel(), timeoutAfter(2_000)])
    }
  })

export const ensureRxdbSyncReady = async () =>
  runQueued(async () => {
    await ensureSyncStateReady()
    syncValidationErrors = []
  })

export const runRxdbSyncCycle = async () =>
  runQueued(async () => {
    await ensureSyncStateReady()

    if (!getAuth()?.accessToken) {
      const message = 'Sync failed: session expired, please log in again'
      await setStatus('error', message)
      throw new Error(message)
    }

    await setStatus('syncing')
    const entityErrors: string[] = []

    // Process entities in parallel using a bounded worker pool.
    // Each worker pulls from the shared queue until it is empty, so we never
    // open more than RXDB_SYNC_PARALLEL_LIMIT databases at once while still
    // keeping all workers busy.
    const queue = [...SYNC_ENTITY_TYPES]
    const runWorker = async () => {
      while (queue.length > 0) {
        const entityType = queue.shift()
        if (!entityType) return
        try {
          await syncEntity(entityType)
        } catch (error) {
          entityErrors.push(`${entityType}: ${extractSyncErrorMessage(error)}`)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(RXDB_SYNC_PARALLEL_LIMIT, SYNC_ENTITY_TYPES.length) }, runWorker),
    )

    const errors = [...entityErrors, ...syncValidationErrors]
    if (errors.length > 0) {
      const message = errors.join('; ')
      await setStatus('error', message)
      throw new Error(message)
    }
    await setStatus('idle')
  })

export const enqueueRxdbSyncChange = async <T extends SyncEntityType>(
  entityType: T,
  op: 'upsert' | 'delete',
  payload: SyncPayload<T>,
  deletedAt?: number | null,
) =>
  runQueued(async () => {
    await ensureSyncStateReady()
    await withCollection(entityType, async (collection) => {
      await seedCollectionFromDexie(entityType, collection)
      const timestamp = deletedAt ?? ('updatedAt' in payload && typeof payload.updatedAt === 'number' ? payload.updatedAt : now())
      await collection.upsert({
        ...(payload as SyncPayload),
        updatedAt: timestamp,
        deletedAt: op === 'delete' ? timestamp : undefined,
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
        closeDuplicates: true,
      })
      await database.remove()
    }
  })
