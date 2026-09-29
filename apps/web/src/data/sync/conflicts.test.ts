// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { DB_NAME, schemaV44 } from '../db/schema'
import { listOpenSyncConflicts, listSyncConflicts, markSyncConflictReviewed, recordSyncConflict, restoreNoteConflictAsCopy, syncDocumentsDiffer } from './conflicts'

describe('sync conflict recovery copies', () => {
  beforeEach(async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  afterEach(async () => {
    await db.delete({ disableAutoOpen: false })
  })

  it('keeps both divergent versions under the matching account and avoids duplicate alerts', async () => {
    const local = { id: 'note-1', title: 'Draft', contentMd: 'Local edit', updatedAt: 100, _deleted: false }
    const remote = { id: 'note-1', title: 'Draft', contentMd: 'Cloud edit', updatedAt: 200, _deleted: false }
    expect(syncDocumentsDiffer(local, remote)).toBe(true)
    expect(await recordSyncConflict('account-a', 'notes', local, remote)).toBe(true)
    expect(await recordSyncConflict('account-a', 'notes', local, remote)).toBe(false)
    const copies = await listOpenSyncConflicts('account-a')
    expect(copies).toHaveLength(1)
    expect(copies[0].localDocument.contentMd).toBe('Local edit')
    expect(copies[0].remoteDocument.contentMd).toBe('Cloud edit')
    expect(await listSyncConflicts('account-b')).toHaveLength(0)
    expect(await markSyncConflictReviewed('account-b', copies[0].id)).toBe(false)
    expect(await markSyncConflictReviewed('account-a', copies[0].id)).toBe(true)
    expect(await listOpenSyncConflicts('account-a')).toHaveLength(0)
    expect(await listSyncConflicts('account-a')).toHaveLength(1)
  })

  it('does not flag only a timestamp or RxDB metadata change', () => {
    expect(syncDocumentsDiffer(
      { id: 'task-1', title: 'Task', updatedAt: 100, _deleted: false, _rev: '1' },
      { id: 'task-1', title: 'Task', updatedAt: 200, _deleted: false, _rev: '2' },
    )).toBe(false)
    expect(syncDocumentsDiffer(
      { id: 'task-1', title: 'Task', updatedAt: 100, _deleted: false },
      { title: 'Task', _deleted: false, updatedAt: 200, id: 'task-1' },
    )).toBe(false)
    expect(syncDocumentsDiffer(
      { id: 'task-1', title: 'Task', updatedAt: 100, deletedAt: null },
      { id: 'task-1', title: 'Task', updatedAt: 200, _deleted: false },
    )).toBe(false)
    expect(syncDocumentsDiffer(
      { id: 'task-1', title: 'Task', updatedAt: 100, _deleted: false },
      { id: 'task-1', title: 'Task', updatedAt: 100, _deleted: true },
    )).toBe(true)
  })

  it('restores an account-owned local note as a distinct copy without replacing the cloud winner', async () => {
    const local = { id: 'note-1', title: 'Draft', contentMd: 'Offline paragraph', contentJson: { type: 'doc', content: [] }, tags: ['work'], collection: 'work', updatedAt: 100 }
    const remote = { ...local, contentMd: 'Cloud paragraph', updatedAt: 200 }
    await db.notes.put({ ...remote, id: 'note-1', createdAt: 1, editorMode: 'document', pinned: false, deletedAt: null } as never)
    await recordSyncConflict('account-a', 'notes', local, remote)
    const conflict = (await listOpenSyncConflicts('account-a'))[0]
    await expect(restoreNoteConflictAsCopy('account-b', conflict.id, 'Untitled', '(restored)')).rejects.toThrow()
    const restoredId = await restoreNoteConflictAsCopy('account-a', conflict.id, 'Untitled', '(restored)')
    expect(restoredId).not.toBe('note-1')
    expect((await db.notes.get('note-1'))?.contentMd).toBe('Cloud paragraph')
    expect((await db.notes.get(restoredId))?.contentMd).toBe('Offline paragraph')
    expect((await db.notes.get(restoredId))?.title).toBe('Draft (restored)')
    expect(await restoreNoteConflictAsCopy('account-a', conflict.id, 'Untitled', '(restored)')).toBe(restoredId)
    await db.syncConflicts.update(conflict.id, { restoredEntityId: null, resolvedAt: null })
    expect(await restoreNoteConflictAsCopy('account-a', conflict.id, 'Untitled', '(restored)')).toBe(restoredId)
    expect(await db.notes.where('id').startsWith('recovered-').count()).toBe(1)
    expect((await listSyncConflicts('account-a'))[0].resolvedAt).toBeGreaterThan(0)
  })

  it('keeps an unreadable local copy pending instead of creating an empty note', async () => {
    await recordSyncConflict('account-a', 'notes', { id: 'missing-body', title: 'Draft', updatedAt: 100 },
      { id: 'missing-body', title: 'Cloud', contentMd: 'Present', updatedAt: 200 })
    const conflict = (await listOpenSyncConflicts('account-a'))[0]
    await expect(restoreNoteConflictAsCopy('account-a', conflict.id, 'Untitled', '(restored)')).rejects.toThrow('no readable note body')
    expect(await listOpenSyncConflicts('account-a')).toHaveLength(1)
    expect(await db.notes.count()).toBe(0)
  })

  it('upgrades an existing v44 workspace without losing its notes', async () => {
    await db.delete({ disableAutoOpen: false })
    const legacy = new Dexie(DB_NAME)
    legacy.version(44).stores(schemaV44)
    await legacy.open()
    await legacy.table('notes').put({ id: 'before-upgrade', title: 'Keep me', updatedAt: 10 })
    legacy.close()

    await db.open()
    expect((await db.notes.get('before-upgrade'))?.title).toBe('Keep me')
    expect(await db.syncConflicts.count()).toBe(0)
  })
})
