import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ owner: 'guest' }))
vi.mock('../../store/auth', () => ({ getAuth: () => auth.owner === 'guest' ? null : { user: { id: auth.owner } } }))
vi.mock('./rxdb', () => ({ resetRxdbSyncDatabase: vi.fn() }))
vi.stubGlobal('localStorage', { removeItem: vi.fn(), getItem: () => null, setItem: vi.fn() })
import { db, requestCrossTabDbReset } from '../db'
import { SYNC_ENTITY_TABLES } from './constants'
import { clearLocalUserData, restampLocalSnapshotForRestore, syncStateRepo } from './repository'

describe('sync repository', () => {
  beforeEach(async () => {
    auth.owner = 'guest'
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('clears only the outgoing account Labs records and preserves guest and other accounts', async () => {
    for (const ownerId of ['guest', 'account-a', 'account-b']) {
      await db.localSymbolic.put({ ownerId, id:'selection', kind:'settings', schemaVersion:1, updatedAt:1, payload:{ profileId:null } })
    }
    auth.owner = 'account-a'
    requestCrossTabDbReset()
    expect(db.isOpen()).toBe(false)
    await clearLocalUserData()
    expect((await db.localSymbolic.toArray()).map(row => row.ownerId).sort()).toEqual(['account-b','guest'])
    auth.owner = 'guest'
    await clearLocalUserData()
    expect(await db.localSymbolic.count()).toBe(2)
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
