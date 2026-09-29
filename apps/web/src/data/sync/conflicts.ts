import { db } from '../db'
import { notesRepo } from '../repositories/notesRepo'
import type { NoteCollection } from '../models/types'
import type { SyncEntityType } from './types'

export type SyncConflictRecord = {
  id: string
  accountId: string
  entityType: SyncEntityType
  entityId: string
  localDocument: Record<string, unknown>
  remoteDocument: Record<string, unknown>
  createdAt: number
  resolvedAt: number | null
  restoredEntityId?: string | null
}

const stripInternalFields = (document: Record<string, unknown>) => {
  const result = { ...document }
  delete result._meta
  delete result._attachments
  delete result._rev
  return result
}

const comparable = (document: Record<string, unknown>) => {
  const result = stripInternalFields(document)
  delete result.updatedAt
  result._deleted = Boolean(result._deleted)
  // RxDB omits undefined optional fields while Dexie retains explicit nulls.
  // Treat both representations of an active record as the same document.
  if (!result._deleted && result.deletedAt == null) delete result.deletedAt
  return result
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export const syncDocumentsDiffer = (left: Record<string, unknown>, right: Record<string, unknown>) =>
  stableStringify(comparable(left)) !== stableStringify(comparable(right))

export const recordSyncConflict = async (
  accountId: string,
  entityType: SyncEntityType,
  localDocument: Record<string, unknown>,
  remoteDocument: Record<string, unknown>,
) => {
  const local = stripInternalFields(localDocument)
  const remote = stripInternalFields(remoteDocument)
  if (!syncDocumentsDiffer(local, remote)) return false
  const entityId = String(local.id)
  const existing = await db.syncConflicts
    .where('accountId').equals(accountId)
    .filter((item) => item.entityType === entityType && item.entityId === entityId && item.resolvedAt === null)
    .toArray()
  if (existing.some((item) => stableStringify(item.localDocument) === stableStringify(local)
    && stableStringify(item.remoteDocument) === stableStringify(remote))) return false
  await db.syncConflicts.add({
    id: crypto.randomUUID(),
    accountId,
    entityType,
    entityId,
    localDocument: local,
    remoteDocument: remote,
    createdAt: Date.now(),
    resolvedAt: null,
  })
  return true
}

export const listOpenSyncConflicts = (accountId: string) =>
  db.syncConflicts.where('accountId').equals(accountId)
    .filter((item) => item.resolvedAt === null)
    .toArray()
    .then((items) => items.sort((left, right) => right.createdAt - left.createdAt))

export const listSyncConflicts = (accountId: string) =>
  db.syncConflicts.where('accountId').equals(accountId).toArray()
    .then((items) => items.sort((left, right) => right.createdAt - left.createdAt))

export const markSyncConflictReviewed = async (accountId: string, id: string) => {
  const item = await db.syncConflicts.get(id)
  if (!item || item.accountId !== accountId) return false
  await db.syncConflicts.update(id, { resolvedAt: Date.now() })
  return true
}

const noteCollections: NoteCollection[] = ['all-notes', 'work', 'personal', 'ideas']

/** Keep the cloud winner intact; recovery creates a separate note with a new ID. */
export const restoreNoteConflictAsCopy = async (accountId: string, id: string, fallbackTitle: string, suffix: string) => {
  const item = await db.syncConflicts.get(id)
  if (!item || item.accountId !== accountId || item.entityType !== 'notes') {
    throw new Error('Conflict copy is unavailable for this account')
  }
  if (item.restoredEntityId) return item.restoredEntityId
  const source = item.localDocument
  if (source._deleted === true) throw new Error('A deleted note has no local content to restore')
  const recoveryId = `recovered-${item.id}`
  const title = typeof source.title === 'string' && source.title.trim() ? source.title.trim() : fallbackTitle
  const collection = noteCollections.includes(source.collection as NoteCollection)
    ? source.collection as NoteCollection
    : 'all-notes'
  const contentJson = source.contentJson && typeof source.contentJson === 'object' && !Array.isArray(source.contentJson)
    ? source.contentJson as Record<string, unknown>
    : null
  if (typeof source.contentMd !== 'string' && !contentJson) {
    throw new Error('Conflict copy has no readable note body')
  }
  if (!(await db.notes.get(recoveryId))) {
    try {
      await notesRepo.create({
        id: recoveryId,
        title: `${title} ${suffix}`,
        contentMd: typeof source.contentMd === 'string' ? source.contentMd : '',
        contentJson,
        collection,
        tags: Array.isArray(source.tags) ? source.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        pinned: false,
      })
    } catch (error) {
      // Another tab may have created the same deterministic recovery ID first.
      if (!(await db.notes.get(recoveryId))) throw error
    }
  }
  await db.syncConflicts.update(id, { restoredEntityId: recoveryId, resolvedAt: Date.now() })
  return recoveryId
}
