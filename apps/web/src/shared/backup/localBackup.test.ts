import { describe, expect, it } from 'vitest'
import { exportLocalBackup, importLocalBackup, type LocalBackupDatabaseAdapter, type LocalBackupStorageAdapter } from './localBackup'

const createDbAdapter = (tables: Record<string, unknown[]> = {}): LocalBackupDatabaseAdapter & { tables: Record<string, unknown[]> } => ({
  tables,
  async exportTables(names) {
    return Object.fromEntries(names.map((name) => [name, structuredClone(this.tables[name] ?? [])]))
  },
  async replaceTables(nextTables) {
    this.tables = structuredClone(nextTables)
  },
})

const createStorageAdapter = (entries: Record<string, string> = {}): LocalBackupStorageAdapter & { entries: Record<string, string> } => ({
  entries,
  readAll() {
    return { ...this.entries }
  },
  replaceAll(nextEntries) {
    this.entries = { ...nextEntries }
  },
})

describe('localBackup', () => {
  it('exports indexeddb tables and localStorage entries into one backup payload', async () => {
    const db = createDbAdapter({
      tasks: [{ id: 'task-1', title: 'Ship backup' }],
      binary_cache: [{ id: 'asset-1', storage: 'blob', blob: new Blob(['hello'], { type: 'text/plain' }) }],
    })
    const storage = createStorageAdapter({
      'workbench.ui.language': 'zh',
      'focusgo.tasks.reminder.enabled.v1': 'true',
    })

    const backup = await exportLocalBackup({
      db,
      storage,
      tableNames: ['tasks', 'binary_cache'],
      dbName: 'workbench-app',
      dbVersion: 17,
      createdAt: 1,
    })

    expect(backup.format).toBe('focus-go-local-backup')
    expect(backup.schemaVersion).toBe(1)
    expect(backup.localStorage['workbench.ui.language']).toBe('zh')
    expect(backup.db.tables.tasks).toEqual([{ id: 'task-1', title: 'Ship backup' }])
    expect(backup.db.tables.binary_cache[0]).toMatchObject({
      id: 'asset-1',
      storage: 'blob',
      blob: {
        __type: 'blob',
        mimeType: 'text/plain',
        base64: 'aGVsbG8=',
      },
    })
  })

  it('excludes protected auth keys from backup export and preserves current auth on restore', async () => {
    const db = createDbAdapter({
      tasks: [{ id: 'task-1', title: 'Keep auth' }],
    })
    const storage = createStorageAdapter({
      auth: '{"accessToken":"current-token"}',
      oauth_state: 'state-1',
      pkce_verifier: 'verifier-1',
      'workbench.ui.language': 'zh',
    })

    const backup = await exportLocalBackup({
      db,
      storage,
      tableNames: ['tasks'],
      dbName: 'workbench-app',
      dbVersion: 17,
      createdAt: 1,
    })

    expect(backup.localStorage).toEqual({
      'workbench.ui.language': 'zh',
    })

    await importLocalBackup(
      {
        format: 'focus-go-local-backup',
        schemaVersion: 1,
        createdAt: 2,
        db: {
          name: 'workbench-app',
          version: 17,
          tables: {
            tasks: [{ id: 'task-2', title: 'Restored task' }],
          },
        },
        localStorage: {
          'workbench.ui.language': 'en',
          auth: '{"accessToken":"stale-token"}',
          oauth_state: 'state-2',
          pkce_verifier: 'verifier-2',
        },
      },
      {
        db,
        storage,
        tableNames: ['tasks'],
      },
    )

    expect(db.tables.tasks).toEqual([{ id: 'task-2', title: 'Restored task' }])
    expect(storage.entries).toEqual({
      auth: '{"accessToken":"current-token"}',
      oauth_state: 'state-1',
      pkce_verifier: 'verifier-1',
      'workbench.ui.language': 'en',
    })
  })

  it('replaces current local state with supported backup content and ignores unknown tables', async () => {
    const db = createDbAdapter({
      tasks: [{ id: 'stale-task', title: 'Old' }],
      binary_cache: [],
    })
    const storage = createStorageAdapter({
      stale: '1',
    })

    await importLocalBackup(
      {
        format: 'focus-go-local-backup',
        schemaVersion: 99,
        createdAt: 2,
        db: {
          name: 'workbench-app',
          version: 99,
          tables: {
            tasks: [{ id: 'task-2', title: 'Restored task' }],
            binary_cache: [{ id: 'asset-2', storage: 'blob', blob: { __type: 'blob', mimeType: 'text/plain', base64: 'd29ybGQ=' } }],
            future_table: [{ id: 'future-1' }],
          },
        },
        localStorage: {
          'workbench.ui.language': 'en',
        },
      },
      {
        db,
        storage,
        tableNames: ['tasks', 'binary_cache'],
      },
    )

    expect(db.tables.tasks).toEqual([{ id: 'task-2', title: 'Restored task' }])
    expect(db.tables.binary_cache).toHaveLength(1)
    expect(db.tables.future_table).toBeUndefined()
    expect(storage.entries).toEqual({ 'workbench.ui.language': 'en' })
    const restoredAsset = db.tables.binary_cache[0] as { id: string; storage: string; blob: Blob }
    expect(restoredAsset).toMatchObject({
      id: 'asset-2',
      storage: 'blob',
    })
    expect(restoredAsset).toHaveProperty('blob')
    expect(restoredAsset.blob).toBeInstanceOf(Blob)
    await expect(restoredAsset.blob.text()).resolves.toBe('world')
  })

  it('rejects files that do not match the backup envelope', async () => {
    const db = createDbAdapter()
    const storage = createStorageAdapter()

    await expect(
      importLocalBackup(
        {
          hello: 'world',
        },
        {
          db,
          storage,
          tableNames: ['tasks'],
        },
      ),
    ).rejects.toThrow('Invalid backup file')
  })
})
