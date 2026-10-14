import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { DB_NAME, schemaV46 } from '../db/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { drainPendingSyncChanges, hasPendingSyncChange, persistPendingSyncChange } from './pendingChanges'

beforeEach(async () => { await db.delete({ disableAutoOpen: false }); await db.open() })

describe('durable sync handoff', () => {
  it('upgrades existing version 46 without losing the task recycle bin', async () => {
    await db.delete({ disableAutoOpen: false })
    const legacy = new Dexie(DB_NAME)
    legacy.version(46).stores(schemaV46)
    await legacy.open()
    await legacy.table('task_trash').put({ id: 'deleted-task', deletedAt: 1, title: 'Keep me' })
    legacy.close()
    await db.open()
    expect(await db.taskTrash.get('deleted-task')).toMatchObject({ id: 'deleted-task', title: 'Keep me' })
    await persistPendingSyncChange('tasks', 'delete', { id: 't', updatedAt: 2 }, 2)
    expect(await hasPendingSyncChange('tasks', 't')).toBe(true)
  })

  it('retains deletes across reopening and a failed handoff, then replays in order', async () => {
    await persistPendingSyncChange('tasks', 'delete', { id: 't', updatedAt: 2 }, 2)
    db.close()
    await db.open()
    await expect(drainPendingSyncChanges(async () => { throw new Error('unavailable') })).rejects.toThrow('unavailable')
    expect(await hasPendingSyncChange('tasks', 't')).toBe(true)
    await persistPendingSyncChange('tasks', 'upsert', { id: 't', updatedAt: 3, title: 'Restored' })
    const operations: string[] = []
    await drainPendingSyncChanges(async change => { operations.push(change.op) })
    expect(operations).toEqual(['delete', 'upsert'])
    expect(await hasPendingSyncChange('tasks', 't')).toBe(false)
  })

  it('does not acknowledge a newer edit arriving during handoff', async () => {
    await persistPendingSyncChange('tasks', 'upsert', { id: 't', updatedAt: 1 })
    await drainPendingSyncChanges(async () => {
      await persistPendingSyncChange('tasks', 'delete', { id: 't', updatedAt: 2 }, 2)
    })
    expect((await db.pendingSyncChanges.toArray()).map(change => change.op)).toEqual(['delete'])
  })

  it('rolls back the task and its handoff record together on local failure', async () => {
    await expect(db.transaction('rw', db.tasks, db.pendingSyncChanges, async () => {
      await db.tasks.put({ id: 't', updatedAt: 1 } as never)
      await persistPendingSyncChange('tasks', 'upsert', { id: 't', updatedAt: 1 })
      throw new Error('abort')
    })).rejects.toThrow('abort')
    expect(await db.tasks.get('t')).toBeUndefined()
    expect(await hasPendingSyncChange('tasks', 't')).toBe(false)
  })
})
