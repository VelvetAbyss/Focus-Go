import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createBackupDownload, readBackupFile, exportLocalBackup, importLocalBackup, type LocalBackupDatabaseAdapter, type LocalBackupStorageAdapter } from './localBackup'

const createDbAdapter = (tables: Record<string, unknown[]> = {}): LocalBackupDatabaseAdapter & { tables: Record<string, unknown[]> } => ({
  tables,
  async exportTables(names) {
    return Object.fromEntries(names.map((name) => [name, structuredClone(this.tables[name] ?? [])]))
  },
  async replaceTables(nextTables, beforeCommit) {
    beforeCommit?.()
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

    expect(backup.manifest.format).toBe('focus-go-local-backup-v2')
    expect(backup.manifest.schemaVersion).toBe(2)
    expect(backup.localStorage['workbench.ui.language']).toBe('zh')
    expect(backup.manifest.db.tables.tasks).toEqual([{ id: 'task-1', title: 'Ship backup', taskNoteBlocks: [] }])
    expect(backup.manifest.db.tables.binary_cache[0]).toMatchObject({
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
        schemaVersion: 1,
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
        { hello: 'world' } as never,
        {
          db,
          storage,
          tableNames: ['tasks'],
        },
      ),
    ).rejects.toThrow('Invalid backup file')
  })

  it('creates a non-empty zip backup archive', async () => {
    const backup = await exportLocalBackup({
      db: createDbAdapter({
        tasks: [{ id: 'task-1', title: 'Ship backup' }],
      }),
      storage: createStorageAdapter({
        'workbench.ui.language': 'zh',
      }),
      tableNames: ['tasks'],
      dbName: 'workbench-app',
      dbVersion: 17,
      createdAt: 1,
    })

    const download = await createBackupDownload(backup)
    expect(download.blob.size).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(await download.blob.arrayBuffer())
    expect(await zip.file('manifest.json')?.async('string')).toContain('focus-go-local-backup-v2')
    expect(await zip.file('localStorage/settings.json')?.async('string')).toContain('workbench.ui.language')
  })
  it('round-trips a compressed note body and rejects corrupt blob metadata before writing', async () => {
    const db = createDbAdapter({ notes: [{ id: 'note-1', title: 'Note', contentMd: 'Preserve this body' }] })
    const storage = createStorageAdapter({ theme: 'light' })
    const options = { db, storage, tableNames: ['notes'] }
    const backup = await exportLocalBackup({ ...options, dbName: 'test', dbVersion: 1 })
    const download = await createBackupDownload(backup)
    const parsed = await readBackupFile(new File([download.blob], 'backup.zip'))
    await importLocalBackup(parsed, options)
    expect(db.tables.notes[0]).toMatchObject({ contentMd: 'Preserve this body' })
    const hash = Object.keys(backup.blobs)[0]
    backup.blobs[hash].rawByteLength += 1
    await expect(importLocalBackup(backup, options)).rejects.toThrow('metadata mismatch')
    expect(db.tables.notes[0]).toMatchObject({ contentMd: 'Preserve this body' })
    URL.revokeObjectURL(download.url)
  })

  it('filters injected auth settings out of v2 backups even without an existing session', async () => {
    const db = createDbAdapter({ tasks: [{ id: 'a', title: 'A' }] })
    const storage = createStorageAdapter()
    const options = { db, storage, tableNames: ['tasks'] }
    const backup = await exportLocalBackup({ ...options, dbName: 'test', dbVersion: 1 })
    backup.localStorage.auth = 'injected'
    backup.localStorage['focusgo.local-data-owner.v1'] = 'other-account'
    await importLocalBackup(backup, options)
    expect(storage.entries).toEqual({})
  })

  it('accepts uncompressed attachment blobs used by task images', async () => {
    const db = createDbAdapter({ tasks: [{ id: 'task', title: 'Image task' }] })
    const storage = createStorageAdapter()
    const options = { db, storage, tableNames: ['tasks'] }
    const backup = await exportLocalBackup({ ...options, dbName: 'test', dbVersion: 1 })
    const hash = 'a'.repeat(64)
    const metadata = { contentType: 'image/png' as const, compression: 'none' as const, byteLength: 5, rawByteLength: 5 }
    backup.manifest.blobs[hash] = metadata
    backup.blobs[hash] = { ...metadata, hash, dataBase64: 'aGVsbG8=' }
    await expect(importLocalBackup(backup, options)).resolves.toBeUndefined()
  })

})
