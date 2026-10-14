import { describe, expect, it } from 'vitest'
import { countLocalData, summarizeBackup } from './backupSummary'
import { LOCAL_BACKUP_FORMAT, LOCAL_BACKUP_V2_FORMAT, type ParsedLocalBackup } from './localBackup'

const tables = {
  tasks: [{ id: 't1' }, { id: 't2' }],
  notes: [{ id: 'n1', deletedAt: null }, { id: 'n2', deletedAt: 1700000000000 }],
  diary_entries: [{ id: 'd1' }],
  unknown_table: [{ id: 'x' }],
}

describe('backup summary', () => {
  it('counts what a v2 backup holds, leaving out trashed notes', () => {
    const payload = {
      manifest: { format: LOCAL_BACKUP_V2_FORMAT, schemaVersion: 2, createdAt: 1760000000000, db: { name: 'x', version: 46, tables }, blobs: {} },
      localStorage: {},
      blobs: {},
    } as unknown as ParsedLocalBackup
    expect(summarizeBackup(payload)).toEqual({
      createdAt: 1760000000000,
      counts: { tasks: 2, projects: 0, notes: 1, diary: 1, focus: 0, habits: 0, spends: 0 },
    })
  })

  it('reads a legacy backup the same way', () => {
    const payload = { format: LOCAL_BACKUP_FORMAT, schemaVersion: 1, createdAt: 5, db: { name: 'x', version: 30, tables }, localStorage: {} } as unknown as ParsedLocalBackup
    expect(summarizeBackup(payload).counts.tasks).toBe(2)
    expect(summarizeBackup(payload).createdAt).toBe(5)
  })

  it('counts this device through the same rules', async () => {
    const database = { table: (name: string) => ({ toArray: async () => (tables as Record<string, unknown[]>)[name] ?? [] }) }
    expect(await countLocalData(database)).toMatchObject({ tasks: 2, notes: 1, diary: 1, projects: 0 })
  })
})
