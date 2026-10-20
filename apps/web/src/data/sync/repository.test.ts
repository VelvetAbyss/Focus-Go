import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ owner: 'guest' }))
vi.mock('../../store/auth', () => ({ getAuth: () => auth.owner === 'guest' ? null : { user: { id: auth.owner } } }))
vi.mock('./rxdb', () => ({ resetRxdbSyncDatabase: vi.fn() }))
vi.stubGlobal('localStorage', { removeItem: vi.fn(), getItem: () => null, setItem: vi.fn() })
import { db, requestCrossTabDbReset } from '../db'
import { SYNC_ENTITY_TABLES } from './constants'
import { clearLocalUserData, recoverAfterInterruptedReset, restampLocalSnapshotForRestore, syncStateRepo } from './repository'

describe('sync repository', () => {
  beforeEach(async () => {
    auth.owner = 'guest'
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('clears only the outgoing account Labs records and preserves guest and other accounts', async () => {
    for (const ownerId of ['guest', 'account-a', 'account-b']) {
      await db.localSymbolic.put({ ownerId, id:'selection', kind:'settings', schemaVersion:1, updatedAt:1, dirty:false, revision:1, payload:{ profileId:null } })
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


describe('removal safety barrier', () => {
  beforeEach(async () => { auth.owner = 'account-a'; await db.delete({ disableAutoOpen: false }); await db.open() })
  const task = () => ({ id: 'unsent-task', title: 'Inspect Bestbuy image quality', updatedAt: Date.now(), createdAt: 1 } as never)
  it('retains handed-off edits and the entity when logout attempts to clear them', async () => {
    await db.tasks.put(task())
    await db.pendingSyncChanges.toCollection().modify({ handedOff: true })
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'account-a' })
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
    expect((await db.tasks.get('unsent-task'))?.title).toBe('Inspect Bestbuy image quality')
    expect(await db.pendingSyncChanges.count()).toBeGreaterThan(0)
  })
  it('does not treat an empty outbox as proof of cloud confirmation for legacy data', async () => {
    await db.tasks.put(task())
    await db.pendingSyncChanges.clear()
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
    expect(await db.tasks.count()).toBe(1)
  })
  it('rechecks a new edit committed after an earlier successful safety check', async () => {
    const { assertLocalDataSafeToRemove } = await import('./safety')
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'account-a' })
    await db.transaction('r', db.tables, () => assertLocalDataSafeToRemove())
    await db.tasks.put(task())
    await expect(clearLocalUserData(true)).rejects.toThrow('local_data_not_cloud_confirmed')
    expect(await db.tasks.count()).toBe(1)
  })
  it('blocks a clear while synchronization is active even with no pending edits', async () => {
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'account-a', status: 'syncing' })
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
  })
  it('clears a cloud-confirmed snapshot atomically once all edits have been acknowledged', async () => {
    await db.tasks.put(task())
    await db.pendingSyncChanges.clear()
    await syncStateRepo.patch({ lastCloudConfirmedAt: Date.now(), cloudConfirmedAccountId: 'account-a' })
    await clearLocalUserData(true)
    expect(await db.tasks.count()).toBe(0)
    expect(await db.pendingSyncChanges.count()).toBe(0)
  })

  it('never accepts another account’s cloud confirmation as permission to remove local records', async () => {
    await db.tasks.put({ id: 'foreign-proof', title: 'Keep original', updatedAt: 1, createdAt: 1 } as never)
    await db.pendingSyncChanges.clear()
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'another-account' })
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
    expect(await db.tasks.get('foreign-proof')).toBeTruthy()
  })

  it('invalidates confirmation and retains new edits if a server wipe was followed by an interrupted local reset', async () => {
    await db.tasks.put(task())
    const pending = await db.pendingSyncChanges.toArray()
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'account-a' })
    await recoverAfterInterruptedReset()
    expect(await db.pendingSyncChanges.toArray()).toEqual(pending)
    expect(await db.tasks.get('unsent-task')).toBeTruthy()
    expect((await syncStateRepo.get()).lastCloudConfirmedAt).toBeNull()
  })

  it('retains independently queued Labs data even when the main outbox is empty', async () => {
    await syncStateRepo.patch({ lastCloudConfirmedAt: 1, cloudConfirmedAccountId: 'account-a' })
    await db.localSymbolic.put({ ownerId: 'account-a', id: 'birth:test', kind: 'birth-profile', schemaVersion: 1, updatedAt: 1, payload: {}, dirty: true })
    expect(await db.pendingSyncChanges.count()).toBe(0)
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
    expect(await db.localSymbolic.get(['account-a', 'birth:test'])).toBeTruthy()
    const { readSyncSafety } = await import('./safety')
    expect((await readSyncSafety()).pendingCount).toBe(1)
  })
  it('retains conflict copies including a remote-deletion conflict in the Labs channel', async () => {
    await db.localSymbolic.put({ ownerId: 'account-a', id: 'conflict', kind: 'settings', schemaVersion: 1, updatedAt: 1, payload: {}, dirty: false, revision: 1, conflict: null })
    await expect(clearLocalUserData()).rejects.toThrow('local_data_not_cloud_confirmed')
  })
  it('checks all owners for app reset but only the outgoing owner for logout', async () => {
    await db.localSymbolic.put({ ownerId: 'guest', id: 'guest-local', kind: 'settings', schemaVersion: 1, updatedAt: 1, payload: {}, dirty: true })
    await expect(clearLocalUserData(true)).rejects.toThrow('local_data_not_cloud_confirmed')
    await clearLocalUserData()
    expect(await db.localSymbolic.get(['guest', 'guest-local'])).toBeTruthy()
  })
  it('rebases Labs records without deleting content after an ambiguous remote wipe', async () => {
    await db.localSymbolic.bulkPut([
      { ownerId: 'account-a', id: 'record', kind: 'settings', schemaVersion: 1, updatedAt: 1, payload: { retained: true }, dirty: false, revision: 5 },
      { ownerId: 'account-a', id: 'sync-meta', kind: 'sync-meta', schemaVersion: 1, updatedAt: 1, payload: { generation: 'old' } },
      { ownerId: 'guest', id: 'guest-record', kind: 'settings', schemaVersion: 1, updatedAt: 1, payload: {}, dirty: true },
    ])
    await recoverAfterInterruptedReset()
    expect(await db.localSymbolic.get(['account-a', 'record'])).toMatchObject({ payload: { retained: true }, dirty: true, revision: 0 })
    expect(await db.localSymbolic.get(['account-a', 'sync-meta'])).toBeUndefined()
    expect(await db.localSymbolic.get(['guest', 'guest-record'])).toBeTruthy()
  })

})
