import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, expect, it } from 'vitest'
import { db } from './index'
import { DB_NAME, DB_VERSION, schemaV48, TABLES } from './schema'

afterEach(async () => { await db.delete({ disableAutoOpen: false }) })

it('adds CRM to the production V48 database without changing existing records or pending synchronization', async () => {
  await db.delete({ disableAutoOpen: false })
  const legacy = new Dexie(DB_NAME)
  legacy.version(48).stores(schemaV48)
  await legacy.open()
  const preserved = [
    [TABLES.tasks, 'existing-task', { id: 'existing-task', title: 'Existing work', updatedAt: 1 }],
    [TABLES.taskTrash, 'deleted-task', { id: 'deleted-task', deletedAt: 2, task: { id: 'deleted-task', title: 'Recover me' }, links: [] }],
    [TABLES.localSymbolic, ['account-1', 'profile'], { ownerId: 'account-1', id: 'profile', kind: 'profile', payload: { name: 'Saved profile' }, updatedAt: 3 }],
    [TABLES.featureInstallations, 'translation', { id: 'translation', featureKey: 'translation', state: 'installed' }],
    [TABLES.pendingSyncChanges, 1, { id: 1, entityType: 'tasks', entityId: 'existing-task', op: 'upsert', payload: { id: 'existing-task', title: 'Pending edit' } }],
    [TABLES.syncConflicts, 'existing-conflict', { id: 'existing-conflict', entityType: 'notes', entityId: 'note-1' }],
  ] as const
  for (const [table, , record] of preserved) await legacy.table(table).put(record)
  legacy.close()

  await db.open()
  expect(db.verno).toBe(DB_VERSION)
  for (const [table, key, record] of preserved) {
    expect(await db.table(table).get(Array.isArray(key) ? [...key] : key)).toEqual(record)
  }
  for (const table of [db.crmCustomers, db.crmDeals, db.crmActivities]) {
    expect(db.backendDB().objectStoreNames.contains(table.name)).toBe(true)
    expect(await table.count()).toBe(0)
  }
})
