import { db } from '../db'
import type { SyncEntityType, SyncOp, SyncPayload } from './types'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'

export type PendingSyncChange = {
  id?: number
  accountId?: string | null
  handedOff?: boolean
  entityType: SyncEntityType
  entityId: string
  op: SyncOp
  payload: SyncPayload
  deletedAt?: number | null
}

// This can be part of the same IndexedDB transaction as the entity write.
export const persistPendingSyncChange = <T extends SyncEntityType>(
  entityType: T, op: SyncOp, payload: SyncPayload<T>, deletedAt?: number | null,
) => db.pendingSyncChanges.add({ entityType, entityId: payload.id, op, payload, deletedAt,
  accountId: typeof localStorage === 'undefined' ? null : localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY) })

export const pendingForAccount = async (accountId: string) => {
  const entries = await db.pendingSyncChanges.toArray()
  if (entries.some(entry => entry.accountId && entry.accountId !== accountId)) {
    throw new Error('Sync outbox belongs to another account; switch back before syncing')
  }
  return entries
}

export const hasPendingSyncChange = async (entityType: SyncEntityType, id: string) =>
  Boolean(await db.pendingSyncChanges.where('[entityType+entityId]').equals([entityType, id]).first())

export const drainPendingSyncChanges = async (write: (change: PendingSyncChange) => Promise<void>) => {
  // Process a bounded snapshot. New edits stay pending for the next handoff.
  const changes = await db.pendingSyncChanges.toArray()
  for (const change of changes) {
    await write(change)
    // Only acknowledge this operation; a newer edit may have arrived meanwhile.
    await db.pendingSyncChanges.delete(change.id!)
  }
}
