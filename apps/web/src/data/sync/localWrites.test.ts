import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { createDexieDatabaseService } from '../services/DexieDatabaseService'

vi.mock('./rxdb', () => ({
  enqueueRxdbSyncChange: () => new Promise(() => {}),
  flushPendingSyncChanges: () => new Promise(() => {}),
}))

const withinLocalWrite = <T>(promise: Promise<T>) => Promise.race([
  promise,
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Local write waited for cloud sync')), 300)),
])

beforeEach(async () => { await db.delete({ disableAutoOpen: false }); await db.open() })

describe('task writes while cloud sync is stalled', () => {
  it('updates and deletes locally without waiting for the cloud queue', async () => {
    const tasks = createDexieDatabaseService().tasks
    const task = await tasks.add({ title: 'Local', status: 'todo', priority: null })
    const edited = await withinLocalWrite(tasks.update({ ...task, title: 'Edited' }))
    expect(edited.title).toBe('Edited')
    const completed = await withinLocalWrite(tasks.updateStatus(task.id, 'done'))
    expect(completed?.status).toBe('done')
    await withinLocalWrite(tasks.clearAllTags())
    await withinLocalWrite(tasks.remove(task.id))
    expect(await db.tasks.get(task.id)).toBeUndefined()
  })
})
