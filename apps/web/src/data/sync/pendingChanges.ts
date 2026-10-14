import { db } from '../db'
import type { SyncEntityType, SyncOp, SyncPayload } from './types'

export type PendingSyncChange = {
  id?: number
  entityType: SyncEntityType
  entityId: string
  op: SyncOp
  payload: SyncPayload
  deletedAt?: number | null
}

// This can be part of the same IndexedDB transaction as the entity write.
export const persistPendingSyncChange = <T extends SyncEntityType>(
  entityType: T, op: SyncOp, payload: SyncPayload<T>, deletedAt?: number | null,
) => db.pendingSyncChanges.add({ entityType, entityId: payload.id, op, payload, deletedAt })

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
