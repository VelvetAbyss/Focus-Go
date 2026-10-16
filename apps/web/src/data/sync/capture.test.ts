import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { SYNC_ENTITY_TABLES } from './constants'
import { suppressSyncCapture } from './capture'

beforeEach(async () => { await db.delete({ disableAutoOpen: false }); await db.open() })

describe('atomic local sync capture', () => {
  it.each(Object.entries(SYNC_ENTITY_TABLES))('captures %s mutations and deletions without repository enqueue calls', async (entityType, tableName) => {
    const table = db.table(tableName)
    await table.put({ id: 'record', updatedAt: 1, title: 'Original' })
    await table.update('record', { updatedAt: 2, title: 'Edited' })
    await table.delete('record')
    db.close(); await db.open()
    const entries = await db.pendingSyncChanges.toArray()
    expect(entries.map(entry => entry.op)).toEqual(['upsert', 'upsert', 'delete'])
    expect(entries.every(entry => entry.entityType === entityType)).toBe(true)
    expect(entries[1].payload).toMatchObject({ title: 'Edited' })
    expect(entries[2].deletedAt).toBeGreaterThan(2)
  })

  it('rolls back notes and outbox together on interruption, even when caller did not include outbox in scope', async () => {
    await expect(db.transaction('rw', db.notes, async () => {
      await db.notes.put({ id: 'n', updatedAt: 1 } as never)
      throw new Error('interrupted')
    })).rejects.toThrow('interrupted')
    expect(await db.notes.count()).toBe(0)
    expect(await db.pendingSyncChanges.count()).toBe(0)
  })

  it('captures range deletes and skips identical writes', async () => {
    const row = { id: 'n', updatedAt: 1 }
    await db.notes.put(row as never)
    await db.notes.put(row as never)
    expect(await db.pendingSyncChanges.count()).toBe(1)
    await db.notes.clear()
    expect((await db.pendingSyncChanges.toArray()).map(entry => entry.op)).toEqual(['upsert', 'delete'])
  })

  it('keeps only a minimal tombstone when permanently deleting private note bodies', async () => {
    await db.notes.put({ id: 'n', title: 'Private', contentMd: 'private body', crdtState: 'private state', updatedAt: 1 } as never)
    await db.notes.delete('n')
    const deletion = (await db.pendingSyncChanges.toArray()).find(change => change.op === 'delete')
    expect(deletion?.payload).toMatchObject({ id: 'n', title: 'Private' })
    expect(deletion?.payload).not.toHaveProperty('contentMd')
    expect(deletion?.payload).not.toHaveProperty('crdtState')
  })

  it('does not echo remote writes or account reset, but captures the next local write', async () => {
    await db.transaction('rw', db.notes, async () => {
      suppressSyncCapture()
      await db.notes.put({ id: 'remote', updatedAt: 1 } as never)
    })
    expect(await db.pendingSyncChanges.count()).toBe(0)
    await db.notes.update('remote', { updatedAt: 2 })
    expect(await db.pendingSyncChanges.count()).toBe(1)
  })
})
