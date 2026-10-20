import { hasPendingSyncChange, pendingForAccount, type PendingSyncChange } from './pendingChanges'
import { suppressSyncCapture } from './capture'
import { createRxDatabase, removeRxDatabase, type RxCollection } from 'rxdb'
import { replicateRxCollection } from 'rxdb/plugins/replication'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { db } from '../db'
import { createBlobMap, decodeSyncPayload, encodeSyncPayload } from './content'
import { dispatchSyncDataUpdated, SYNC_ENTITY_TABLES, SYNC_STATUS_CHANGED_EVENT } from './constants'
import { syncApi } from './client'
import { getAuth } from '../../store/auth'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'
import { runDomainEventProjections } from '../events/projections'
import { listOpenSyncConflicts, recordSyncConflict, syncDocumentsDiffer, syncNoteMetadataDiffer } from './conflicts'
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
let cycleAccountId: string | null = null
let cycleAccessToken: string | undefined
const isCycleAccountCurrent = () => !cycleAccountId || (getAuth()?.user?.id === cycleAccountId && getAuth()?.accessToken === cycleAccessToken)
const cycleBaselines = new Map<SyncEntityType, Map<string, SyncDocument>>()

const now = () => Date.now()
const getCollectionName = (entityType: SyncEntityType) => `sync${entityType.toLowerCase()}`
const getAccountNamespace = () => {
  const id = (typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY) : null) ?? getAuth()?.user?.id
  // Hex encoding keeps IndexedDB names portable without lossy sanitization.
  return (typeof id === 'string' && id) || (typeof id === 'number' && Number.isFinite(id))
    ? Array.from(new TextEncoder().encode(String(id)), (byte) => byte.toString(16).padStart(2, '0')).join('') : 'local'
}
const getDatabaseName = (entityType: SyncEntityType) => `${RXDB_SYNC_DB_NAME}-${getAccountNamespace()}-${entityType.toLowerCase()}`

export const extractSyncErrorMessage = (error: unknown) => {
  const nestedErrors = (error as { parameters?: { errors?: Array<{ message?: string }> } })?.parameters?.errors
  const nestedMessage = nestedErrors?.find((item) => typeof item?.message === 'string' && item.message.trim())?.message?.trim()
  if (nestedMessage) return nestedMessage
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return 'Sync failed'
}

const runQueued = async <T>(task: () => Promise<T>) => {
  const lockedTask = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request(`focusgo-sync-${getAccountNamespace()}`, task)
    return await task()
  }
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
  const next = await db.transaction('rw', [db.syncState, db.pendingSyncChanges], async () => {
    const current = await db.syncState.get('cloud-sync')
    const timestamp = now()
    const pending = await db.pendingSyncChanges.toArray()
    const pendingLocalRecordCount = new Set(pending.map(change => `${change.entityType}/${change.entityId}`)).size
    const next: SyncState = {
      status: 'idle',
      lastPulledAt: null,
      lastPushedAt: null,
      lastError: null,
      firstSyncResolved: true,
      pendingFirstSync: false,
      pendingBlobPush: false,
      missingBlobPull: false,
      migrationVersion: 3,
      restoreIntegrityStatus: 'ready',
      pendingRemoteRecordCount: 0,
      ...current,
      ...patch,
      pendingLocalRecordCount,
      pendingEntityPush: pendingLocalRecordCount > 0,
      createdAt: current?.createdAt ?? timestamp,
      id: 'cloud-sync',
      updatedAt: timestamp,
    }
    await db.syncState.put(next)
    return next
  })
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

const createConflictHandler = (entityType: SyncEntityType) => ({
  isEqual: (left: SyncDocument, right: SyncDocument) => !syncDocumentsDiffer(left, right),
  resolve: async (input: { newDocumentState: SyncDocument; realMasterState: SyncDocument }) => {
    if (rxdbResetRequested || !isCycleAccountCurrent()) throw new Error('Sync account changed')
    const accountId = getAuth()?.user?.id
    if (typeof accountId !== 'string' || !accountId) {
      throw new Error('Cannot preserve sync conflict without an account ID')
    }
    if (entityType === 'notes' && typeof (input.newDocumentState as Record<string, unknown>).crdtState === 'string'
      && typeof (input.realMasterState as Record<string, unknown>).crdtState === 'string') {
      const { mergeNoteCrdt } = await import('./noteCrdt')
      const merged = mergeNoteCrdt(input.newDocumentState, input.realMasterState)
      if (merged) {
        const metadata = (value: SyncDocument) => Object.fromEntries(['tags', 'collection', 'pinned', 'title'].map(key => [key, value[key as keyof SyncDocument]]))
        if (!recordsEqual(metadata(input.newDocumentState), metadata(input.realMasterState))) {
          await recordSyncConflict(accountId, entityType, input.newDocumentState, input.realMasterState)
        }
        if (await writeDexieEntity(entityType, merged as SyncDocument, input.newDocumentState)) dispatchSyncDataUpdated(entityType)
        return merged as SyncDocument
      }
    }
    await recordSyncConflict(accountId, entityType, input.newDocumentState, input.realMasterState)
    // RxDB does not always emit received$ for a push conflict it resolves.
    // Keep the app's Dexie source aligned with the selected master state.
    if (await writeDexieEntity(entityType, input.realMasterState, input.newDocumentState)) {
      dispatchSyncDataUpdated(entityType)
    }
    return input.realMasterState
  },
})

const openCollection = async (entityType: SyncEntityType) => {
  const database = await createRxDatabase({
    name: getDatabaseName(entityType),
    storage: getRxStorageDexie(),
    multiInstance: false,
    closeDuplicates: true,
  })
  const collectionName = getCollectionName(entityType)
  const collections = await database.addCollections({
    [collectionName]: { schema: collectionSchema, conflictHandler: createConflictHandler(entityType) },
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

const writeDexieEntityUnprotected = async (entityType: SyncEntityType, document: SyncDocument, expectedLocal?: SyncDocument) => {
  if (rxdbResetRequested) return false
  if (!isCycleAccountCurrent()) return false
  const normalized = normalizeSyncDocument(entityType, document, 'pull')
  if (rxdbResetRequested) return false
  // A local edit/delete committed while this network cycle was in flight wins.
  if (!expectedLocal && await hasPendingSyncChange(entityType, normalized.id)) return false
  const tableName = SYNC_ENTITY_TABLES[entityType]
  const table = db.table(tableName)
  const baseline = cycleBaselines.get(entityType)
  if (!expectedLocal && baseline) {
    const current = await table.get(normalized.id)
    const previous = baseline.get(normalized.id)
    if (Boolean(current) !== Boolean(previous) || (current && previous && syncDocumentsDiffer(current, previous))) return false
  }
  if (expectedLocal) {
    const current = (await table.get(normalized.id)) as Record<string, unknown> | undefined
    if (!current || syncDocumentsDiffer(current, expectedLocal)) return false
  }
  if (normalized._deleted) {
    if (entityType === 'domainEvents') {
      console.error('[domain-events] ignoring remote delete for append-only event', normalized.id)
      return false
    }
    if (!(await table.get(normalized.id))) return false
    await table.delete(normalized.id)
    baseline?.delete(normalized.id)
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
    baseline?.set(normalized.id, merged as SyncDocument)
    if (entityType === 'domainEvents') await runDomainEventProjections(merged as DomainEvent)
    return true
  }
}

// Serialize the pending-check and remote apply against local task transactions.
const writeDexieEntity = (entityType: SyncEntityType, document: SyncDocument, expectedLocal?: SyncDocument) =>
  db.transaction('rw', [...new Set([db.table(SYNC_ENTITY_TABLES[entityType]), db.pendingSyncChanges, db.timelineItems])], async () => {
    suppressSyncCapture()
    return writeDexieEntityUnprotected(entityType, document, expectedLocal)
  })

const seedCollectionFromDexie = async (entityType: SyncEntityType, collection: RxCollection<SyncDocument>) => {
  const rows = await db.table(SYNC_ENTITY_TABLES[entityType]).toArray()
  cycleBaselines.set(entityType, new Map(rows.map(row => [row.id, row])))
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
  if (!isCycleAccountCurrent()) throw new Error('Sync account changed')
  const response = await syncApi.rxdbPull({
    entityType,
    checkpoint: checkpoint ?? null,
    limit: batchSize,
  })
  const blobMap = createBlobMap(response.blobs)
  const documents: SyncDocument[] = []
  let invalidDocument = false
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
        invalidDocument = true
        syncValidationErrors.push(`${entityType}: ${extractSyncErrorMessage(error)}`)
      }
    }),
  )
  // Reject the page without advancing its checkpoint. Returning an empty page
  // lets this one-shot replication finish; the cycle reports the validation
  // error below and retries from the original cursor after repair.
  if (invalidDocument) return { documents: [], checkpoint }
  return {
    documents,
    checkpoint: response.checkpoint ?? undefined,
  }
}

const pushHandler = async (entityType: SyncEntityType, rows: Array<RxdbPushRow>) => {
  if (!isCycleAccountCurrent()) throw new Error('Sync account changed')
  // Snapshot operation IDs before the request: a later edit must never be ACKed
  // merely because a previous state of the same record reached the cloud.
  const outbox = (await db.pendingSyncChanges.toArray()).filter(change => change.entityType === entityType)
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

  if (conflicts.length !== response.conflicts.length) throw new Error(`Invalid ${entityType} conflict; outbox retained for retry`)
  for (const row of rows) {
    const conflict = conflicts.find(document => document.id === row.newDocumentState.id)
    if (conflict && entityType !== 'notes') {
      const accountId = getAuth()?.user?.id
      if (!accountId) throw new Error('Cannot preserve sync conflict without an account ID')
      await recordSyncConflict(accountId, entityType, row.newDocumentState, conflict)
    }
    await acknowledgeOutbox(entityType, row.newDocumentState, outbox)
  }
  return conflicts
}

const acknowledgeOutbox = async (entityType: SyncEntityType, document: SyncDocument, outbox: PendingSyncChange[]) => {
    if (!isCycleAccountCurrent()) throw new Error('Sync account changed')
    const matching = []
    for (const change of outbox.filter(change => change.entityId === document.id)) {
      const original = { ...change.payload, _deleted: change.op === 'delete', ...(change.op === 'delete' ? { deletedAt: change.deletedAt } : {}) }
      let included = !syncDocumentsDiffer(original, document)
      const source = (change.payload as Record<string, unknown>).crdtState
      const target = (document as Record<string, unknown>).crdtState
      if (!included && entityType === 'notes' && change.op !== 'delete' && !document._deleted && typeof source === 'string' && typeof target === 'string') {
        const { containsNoteCrdtState } = await import('./noteCrdt')
        included = !syncNoteMetadataDiffer(original, document) && containsNoteCrdtState(target, source)
      }
      if (included) matching.push(change)
    }
    const throughId = Math.max(0, ...matching.map(change => change.id ?? 0))
    const ids = outbox.filter(change => change.entityId === document.id && (change.id ?? Infinity) <= throughId).map(change => change.id!)
    await db.pendingSyncChanges.bulkDelete(ids)
}

const syncEntity = async (entityType: SyncEntityType) =>
  withCollection(entityType, async (collection) => {
    await seedCollectionFromDexie(entityType, collection)
    const outboxAtStart = (await db.pendingSyncChanges.toArray()).filter(change => change.entityType === entityType)
    const replication = replicateRxCollection<SyncDocument, RxdbCheckpoint>({
      // v2 starts a fresh pull cursor so existing clients move from device
      // timestamps to the server's monotonic sequence checkpoint.
      replicationIdentifier: `focusgo-${getAccountNamespace()}-${entityType}-server-sequence-v3`,
      collection,
      deletedField: '_deleted',
      // The provider owns cycle lifetime. RxDB's non-live start() waits for
      // first success, so cancel() can queue behind it forever after an HTTP
      // failure. Start live, await in-sync here, and always cancel in finally.
      live: true,
      waitForLeadership: false,
      // Keep retryTime well above the per-cycle timeout so a single failure
      // doesn't trigger an in-cycle retry storm against a 500ing server.
      retryTime: 60_000,
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
        const write = writeDexieEntity(entityType, document as SyncDocument)
        // Observe rejection immediately while replication is still running; report it below.
        void write.catch(() => {})
        pendingWrites.push(write)
      },
    })
    const sentSub = replication.sent$.subscribe({
      next: () => {
        void buildStatePatch({ lastPushedAt: now() }).catch(() => {})
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

    let localWriteFailed = false
    try {
      await Promise.race([
        replication.awaitInSync(),
        errorPromise,
        timeoutPromise,
      ])
      for (const id of new Set(outboxAtStart.map(change => change.entityId))) {
        const confirmed = await collection.findOne(id).exec()
        if (confirmed) await acknowledgeOutbox(entityType, confirmed.toJSON() as SyncDocument, outboxAtStart)
      }
    } finally {
      if (timeoutId) globalThis.clearTimeout(timeoutId)
      receivedSub.unsubscribe()
      sentSub.unsubscribe()
      errorSub.unsubscribe()
      // Flush Dexie writes with a safety timeout — guards against db.close() leaving ops hanging.
      // During app reset, do not wait on or issue more Dexie writes because the local DB
      // is being closed and deleted by the settings reset flow.
      let writesTimedOut = false
      let writeTimer: ReturnType<typeof setTimeout> | undefined
      const writeResults = rxdbResetRequested
        ? []
        : await Promise.race([
            Promise.allSettled(pendingWrites),
            new Promise<PromiseSettledResult<boolean>[]>(resolve => { writeTimer = globalThis.setTimeout(() => { writesTimedOut = true; resolve([]) }, 5_000) }),
          ])
      clearTimeout(writeTimer)
      localWriteFailed = writesTimedOut || writeResults.some(result => result.status === 'rejected')
      if (!rxdbResetRequested && writeResults.some((result) => result.status === 'fulfilled' && result.value)) {
        dispatchSyncDataUpdated(entityType)
      }
      if (!rxdbResetRequested && receivedDocumentCount > 0) {
        await buildStatePatch({ lastPulledAt: now(), missingBlobPull: false }).catch(() => {})
      }
      await Promise.race([replication.cancel(), timeoutAfter(2_000)])
      cycleBaselines.delete(entityType)
    }
    if (!rxdbResetRequested && localWriteFailed) throw new Error(`Local ${entityType} save failed; cloud confirmation withheld`)
  })

const handoffPendingSyncChanges = async () => {
  const accountId = getAuth()?.user?.id
  if (!accountId) return
  const changes = await pendingForAccount(accountId)
  const latest = new Map(changes.map(change => [`${change.entityType}/${change.entityId}`, change]))
  for (const { id, entityType, op, payload, deletedAt } of latest.values()) {
    await withCollection(entityType, async (collection) => {
      const current = op === 'upsert' ? await db.table(SYNC_ENTITY_TABLES[entityType]).get(payload.id) : null
      const source = current ?? payload
      const timestamp = deletedAt ?? source.updatedAt
      await collection.upsert({
        ...source,
        updatedAt: timestamp,
        deletedAt: op === 'delete' ? timestamp : undefined,
        _deleted: op === 'delete',
      })
    })
    await db.pendingSyncChanges.update(id!, { handedOff: true })
  }
}

export const flushPendingSyncChanges = () => runQueued(handoffPendingSyncChanges)

export const ensureRxdbSyncReady = async () =>
  runQueued(async () => {
    await ensureSyncStateReady()
    syncValidationErrors = []
  })

export const runRxdbSyncCycle = async (requestedEntities?: SyncEntityType[]) =>
  runQueued(async () => {
    cycleAccountId = getAuth()?.user?.id ?? null
    cycleAccessToken = getAuth()?.accessToken
    await handoffPendingSyncChanges()
    await ensureSyncStateReady()
    syncValidationErrors = []

    if (!getAuth()?.accessToken) {
      const message = 'Sync failed: session expired, please log in again'
      await setStatus('error', message)
      throw new Error(message)
    }

    // No remote request can succeed in a known-offline browser. Keep RxDB's local
    // queue intact and let the provider's online event retry it on reconnect.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const message = 'Sync paused while offline'
      await setStatus('error', message)
      throw new Error(message)
    }

    await setStatus('syncing')
    const entityErrors: string[] = []

    // Process entities in parallel using a bounded worker pool.
    // Each worker pulls from the shared queue until it is empty, so we never
    // open more than RXDB_SYNC_PARALLEL_LIMIT databases at once while still
    // keeping all workers busy.
    const dirty = (await db.pendingSyncChanges.toArray()).map(change => change.entityType)
    const queue = requestedEntities
      ? [...new Set([...requestedEntities, ...dirty])].filter(entity => SYNC_ENTITY_TYPES.includes(entity))
      : [...SYNC_ENTITY_TYPES]
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
    const accountId = getAuth()?.user?.id
    const openConflicts = typeof accountId === 'string' && accountId
      ? await listOpenSyncConflicts(accountId)
      : []
    if (openConflicts.length > 0) {
      await setStatus('blocked', `${openConflicts.length} sync conflict${openConflicts.length === 1 ? '' : 's'} need review`)
      return
    }
    await setStatus('idle')
    const pending = await db.pendingSyncChanges.count()
    const state = await db.syncState.get('cloud-sync')
    if (isCycleAccountCurrent() && pending === 0 && !state?.pendingBlobPush && !state?.missingBlobPull
      && (!requestedEntities || (state?.lastCloudConfirmedAt && state.cloudConfirmedAccountId === accountId))) {
      await buildStatePatch({ lastCloudConfirmedAt: now(), cloudConfirmedAccountId: accountId })
    }
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
      await db.pendingSyncChanges.clear()
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
