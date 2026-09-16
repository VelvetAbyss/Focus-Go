import { createRxDatabase, removeRxDatabase, type RxCollection } from 'rxdb'
import { replicateRxCollection } from 'rxdb/plugins/replication'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { db } from '../db'
import { createBlobMap, decodeSyncPayload, encodeSyncPayload } from './content'
import { dispatchSyncDataUpdated, SYNC_ENTITY_TABLES, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncApi } from './client'
import { getAuth } from '../../store/auth'
import { runDomainEventProjections } from '../events/projections'
import type { DomainEvent } from '../models/types'
import type { RxdbCheckpoint, RxdbPullDocument, RxdbPushRow, SyncEntityType, SyncPayload, SyncState, SyncStatus } from './types'

const RXDB_SYNC_DB_NAME = 'focusgo-sync-rxdb'
const RXDB_SYNC_BATCH_SIZE = 100
const RXDB_SYNC_TIMEOUT_MS = 8_000
const RXDB_SYNC_PARALLEL_LIMIT = 6
const SYNC_ENTITY_TYPES = Object.keys(SYNC_ENTITY_TABLES) as SyncEntityType[]

type SyncDocument = RxdbPullDocument

let rxdbQueue = Promise.resolve()
let syncValidationErrors: string[] = []
let rxdbResetRequested = false

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
  const lockedTask = async (): Promise<T> => typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('focusgo-sync-maintenance', task)
    : task()
  const next = rxdbQueue.then(lockedTask, lockedTask)
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

export const requestRxdbSyncReset = () => {
  rxdbResetRequested = true
}

const resetRxdbStorageDatabases = async () => {
  const storage = getRxStorageDexie()
  for (const entityType of SYNC_ENTITY_TYPES) {
    await removeRxDatabase(getDatabaseName(entityType), storage, false)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stripUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, stripUndefined(nested)]),
  )
}

const recordsEqual = (left: unknown, right: unknown) =>
  JSON.stringify(stripUndefined(left)) === JSON.stringify(stripUndefined(right))

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
  if (entityType === 'domainEvents') {
    if (typeof document.type !== 'string' || document.type.trim().length === 0) {
      throw new Error(`${source} returned invalid type for ${describeSyncDocument(entityType, document)}`)
    }
    if (typeof document.occurredAt !== 'number' || !Number.isFinite(document.occurredAt) || document.occurredAt < 0) {
      throw new Error(`${source} returned invalid occurredAt for ${describeSyncDocument(entityType, document)}`)
    }
    if (typeof document.dedupeKey !== 'string' || document.dedupeKey.trim().length === 0) {
      throw new Error(`${source} returned invalid dedupeKey for ${describeSyncDocument(entityType, document)}`)
    }
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
  if (rxdbResetRequested) return false
  const normalized = normalizeSyncDocument(entityType, document, 'pull')
  if (rxdbResetRequested) return false
  const tableName = SYNC_ENTITY_TABLES[entityType]
  const table = db.table(tableName)
  if (normalized._deleted) {
    if (entityType === 'domainEvents') {
      console.error('[domain-events] ignoring remote delete for append-only event', normalized.id)
      return false
    }
    if (!(await table.get(normalized.id))) return false
    await table.delete(normalized.id)
    return true
  } else {
    const payload = { ...normalized } as Record<string, unknown>
    delete payload._deleted
    // RxDB injects collection-internal fields (_meta, _attachments, _rev) into
    // documents that flow through received$. They must not be written to Dexie
    // tables — _meta.lwt changes every cycle, which would defeat recordsEqual
    // and cause an infinite pull/dispatch loop.
    delete payload._meta
    delete payload._attachments
    delete payload._rev
    const existing = (await table.get(normalized.id)) as Record<string, unknown> | undefined
    // Merge into existing so fields the local layer adds on read (e.g. excerpt,
    // wordCount, contentMd defaults) survive a pull that doesn't carry them.
    // Without this, list() normalizes + bulkPuts defaults → next pull sees a
    // false-diff → writes again → fires dispatchSyncDataUpdated → loop.
    const merged: Record<string, unknown> = existing ? { ...existing, ...payload } : payload
    if (existing && recordsEqual(existing, merged)) return false
    await table.put(merged)
    if (entityType === 'domainEvents') await runDomainEventProjections(merged as DomainEvent)
    return true
  }
}

const seedCollectionFromDexie = async (entityType: SyncEntityType, collection: RxCollection<SyncDocument>) => {
  const rows = await db.table(SYNC_ENTITY_TABLES[entityType]).toArray()
  if (rows.length === 0) return
  const missingOrStaleRows: SyncDocument[] = []
  for (const row of rows) {
    const local = { ...(row as SyncPayload), _deleted: false } as SyncDocument
    const queued = await collection.findOne(local.id).exec()
    if (!queued) {
      missingOrStaleRows.push(local)
      continue
    }
    const queuedData = queued.toJSON() as SyncDocument
    if (queuedData._deleted === true || (queuedData.updatedAt ?? 0) < local.updatedAt) {
      missingOrStaleRows.push(local)
    }
  }
  if (missingOrStaleRows.length > 0) await collection.bulkUpsert(missingOrStaleRows)
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
      // Keep retryTime well above the per-cycle timeout so a single failure
      // doesn't trigger an in-cycle retry storm against a 500ing server.
      retryTime: 60_000,
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

    const pendingWrites: Promise<boolean>[] = []
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
      // Flush Dexie writes with a safety timeout — guards against db.close() leaving ops hanging.
      // During app reset, do not wait on or issue more Dexie writes because the local DB
      // is being closed and deleted by the settings reset flow.
      const writeResults = rxdbResetRequested
        ? []
        : await Promise.race([
            Promise.allSettled(pendingWrites),
            new Promise<PromiseSettledResult<boolean>[]>(resolve => globalThis.setTimeout(() => resolve([]), 5_000)),
          ])
      if (!rxdbResetRequested && writeResults.some((result) => result.status === 'fulfilled' && result.value)) {
        dispatchSyncDataUpdated(entityType)
      }
      if (!rxdbResetRequested && receivedDocumentCount > 0) {
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
    syncValidationErrors = []

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
        if (rxdbResetRequested) return
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

    if (rxdbResetRequested) return

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
    requestRxdbSyncReset()
    try {
      await resetRxdbStorageDatabases()
    } finally {
      rxdbResetRequested = false
    }
    for (const entityType of SYNC_ENTITY_TYPES) {
      await withCollection(entityType, async (collection) => {
        const rows = snapshot[entityType]
        if (rows.length === 0) return
        await collection.bulkUpsert(rows.map((row) => ({ ...row, _deleted: false })))
      })
    }
  })

export const resetRxdbSyncDatabase = async () => {
  requestRxdbSyncReset()
  return runQueued(async () => {
    try {
      await resetRxdbStorageDatabases()
    } finally {
      rxdbResetRequested = false
    }
  })
}

// Run destructive local maintenance only after active replication has drained.
// Keep the whole restore and cache reset ahead of subsequent queued sync work.
export const runRxdbMaintenance = async <T>(task: () => Promise<T>) =>
  runQueued(async () => {
    rxdbResetRequested = true
    try {
      // Reset replication metadata before committing local changes. If this
      // fails, the existing local snapshot is still intact and can be retried.
      await resetRxdbStorageDatabases()
      return await task()
    } finally {
      rxdbResetRequested = false
    }
  })
