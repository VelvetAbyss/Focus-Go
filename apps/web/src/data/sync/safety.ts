import { db } from '../db'
import { getAuth } from '../../store/auth'
import { SYNC_ENTITY_TABLES, SYNC_STATE_ID } from './constants'
import type { LocalSymbolicRecord } from '../models/types'
import { prepareAppUpdate } from '../../shared/runtime/updateLifecycle'

export const symbolicNeedsUpload = (row: LocalSymbolicRecord) => row.kind !== 'sync-meta'
  && !(row.kind === 'profile' && row.deleted && row.dirty === false)
  && (row.dirty !== false || !!row.pending || row.ownerId === 'guest' || !row.revision)

/** Observe both sync channels; destructive reset checks every owner it will remove. */
export const readSyncSafety = (allOwners = false, symbolicOwner: string | null = getAuth()?.user?.id || 'guest') => db.transaction('r', [db.pendingSyncChanges, db.syncConflicts, db.syncState, db.localSymbolic], async () => {
  const [pending, conflicts, state, symbolic] = await Promise.all([
    db.pendingSyncChanges.toArray(), db.syncConflicts.toArray(), db.syncState.get(SYNC_STATE_ID),
    allOwners ? db.localSymbolic.toArray() : symbolicOwner ? db.localSymbolic.where('ownerId').equals(symbolicOwner).toArray() : Promise.resolve([]),
  ])
  const symbolicPending = symbolic.filter(symbolicNeedsUpload)
  const times = [...pending.map(row => row.payload.updatedAt), ...symbolicPending.map(row => row.updatedAt)]
  return {
    pendingCount: new Set(pending.map(row => `${row.entityType}/${row.entityId}`)).size + symbolicPending.length,
    oldestPendingAt: times.length ? Math.min(...times) : null,
    conflictCount: conflicts.filter(row => !row.resolvedAt).length + symbolic.filter(row => row.kind !== 'sync-meta' && row.conflict !== undefined).length,
    state,
  }
})
export type SyncSafety = Awaited<ReturnType<typeof readSyncSafety>>
export class LocalDataNotSafeError extends Error {
  constructor() { super('local_data_not_cloud_confirmed'); this.name = 'LocalDataNotSafeError' }
}

// Called again INSIDE the same readwrite transaction that clears the tables.
// A write in another tab is either included by this check or commits after the clear.
export const assertLocalDataSafeToRemove = async (allOwners = false) => {
  const safety = await readSyncSafety(allOwners, getAuth()?.user?.id || null)
  if (safety.pendingCount || safety.conflictCount || safety.state?.pendingBlobPush
    || safety.state?.missingBlobPull || safety.state?.status === 'error'
    || safety.state?.status === 'syncing' || safety.state?.status === 'blocked') throw new LocalDataNotSafeError()
  if (!safety.state?.lastCloudConfirmedAt || !getAuth()?.user?.id
    || safety.state.cloudConfirmedAccountId !== getAuth()?.user?.id) {
    for (const name of Object.values(SYNC_ENTITY_TABLES)) {
      if (await db.table(name).count()) throw new LocalDataNotSafeError()
    }
  }
}

export const prepareLocalDataRemoval = async (allOwners = false) => {
  await prepareAppUpdate()
  await db.transaction('r', [
    ...Object.values(SYNC_ENTITY_TABLES).map(name => db.table(name)),
    db.pendingSyncChanges, db.syncConflicts, db.syncState, db.localSymbolic,
  ], () => assertLocalDataSafeToRemove(allOwners))
}
