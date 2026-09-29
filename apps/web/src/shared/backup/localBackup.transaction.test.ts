// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTableDatabaseAdapter, importLocalBackup } from './localBackup'

const database = new Dexie('backup-transaction-test')
database.version(1).stores({ tasks: 'id, &title', notes: 'id' })
const adapter = createTableDatabaseAdapter(database, ['tasks', 'notes'])
const payload = () => ({
  format: 'focus-go-local-backup' as const, schemaVersion: 1, createdAt: 1,
  db: { name: 'test', version: 1, tables: { tasks: [{ id: 'new', title: 'New' }] } },
  localStorage: { theme: 'dark', auth: 'untrusted' },
})
let settings: Record<string, string>
const storage = {
  readAll: () => ({ ...settings }),
  replaceAll: (entries: Record<string, string>) => { settings = { ...entries } },
}
beforeEach(async () => {
  await database.open()
  await database.table('tasks').put({ id: 'old', title: 'Original' })
  await database.table('notes').put({ id: 'note' })
  settings = { theme: 'light' }
})
afterEach(() => database.delete({ disableAutoOpen: false }))

describe('atomic backup restore', () => {
  it('rolls all tables back when a later insert violates an index', async () => {
    await expect(adapter.replaceTables({ tasks: [{ id: 'a', title: 'Same' }, { id: 'b', title: 'Same' }] })).rejects.toThrow()
    expect(await database.table('tasks').toArray()).toEqual([{ id: 'old', title: 'Original' }])
    expect(await database.table('notes').count()).toBe(1)
  })
  it('rolls back the database and settings when storage fails midway', async () => {
    let first = true
    await expect(importLocalBackup(payload(), { db: adapter, tableNames: ['tasks', 'notes'], storage: {
      ...storage,
      replaceAll(entries) {
        settings = { partial: 'write' }
        if (first) { first = false; throw new Error('Quota exceeded') }
        storage.replaceAll(entries)
      },
    } })).rejects.toThrow('Quota exceeded')
    expect(await database.table('tasks').get('old')).toBeDefined()
    expect(await database.table('notes').count()).toBe(1)
    expect(settings).toEqual({ theme: 'light' })
  })
  it('rejects future formats and duplicate records before changing data', async () => {
    const invalid = payload()
    invalid.schemaVersion = 99
    await expect(importLocalBackup(invalid, { db: adapter, storage, tableNames: ['tasks'] })).rejects.toThrow('Unsupported')
    invalid.schemaVersion = 1
    invalid.db.tables.tasks.push(invalid.db.tables.tasks[0])
    await expect(importLocalBackup(invalid, { db: adapter, storage, tableNames: ['tasks'] })).rejects.toThrow('duplicate')
    expect(await database.table('tasks').get('old')).toBeDefined()
  })
  it('never imports an auth key into a guest browser', async () => {
    await importLocalBackup(payload(), { db: adapter, storage, tableNames: ['tasks', 'notes'] })
    expect(settings).toEqual({ theme: 'dark' })
    expect(await database.table('tasks').get('new')).toBeDefined()
    expect(await database.table('notes').count()).toBe(0)
  })
})
