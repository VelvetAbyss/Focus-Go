import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_ENTITY_TABLES } from './constants'
import { restampLocalSnapshotForRestore, syncStateRepo } from './repository'

describe('sync repository', () => {
  beforeEach(async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('creates migrated sync state lazily', async () => {
    const initial = await syncStateRepo.get()
    expect(initial.status).toBe('idle')
    expect(initial.firstSyncResolved).toBe(true)
    expect(initial.pendingEntityPush).toBe(false)
    expect(initial.pendingBlobPush).toBe(false)
    expect(initial.restoreIntegrityStatus).toBe('ready')
    expect(initial.migrationVersion).toBe(3)
  })

  it('uses actual Dexie store names for synced entity tables', async () => {
    const actualStores = new Set(Array.from(db.tables, (table) => table.name))
    expect(actualStores.has(SYNC_ENTITY_TABLES.noteTags)).toBe(true)
    expect(actualStores.has(SYNC_ENTITY_TABLES.noteAppearance)).toBe(true)
    expect(actualStores.has(SYNC_ENTITY_TABLES.widgetTodos)).toBe(true)
    expect(actualStores.has(SYNC_ENTITY_TABLES.projects)).toBe(true)
    expect(actualStores.has(SYNC_ENTITY_TABLES.syncedPreferences)).toBe(true)
  })

  it('restamps synced rows before restore upload so restored snapshot wins the next push', async () => {
    await db.tasks.put({
      id: 'task-1',
      title: 'Restored',
      description: '',
      pinned: false,
      isToday: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '',
      taskNoteContentJson: null,
      activityLogs: [],
      createdAt: 1,
      updatedAt: 1,
    })

    await restampLocalSnapshotForRestore()

    expect((await db.tasks.get('task-1'))?.updatedAt).toBeGreaterThan(1)
  })
})
