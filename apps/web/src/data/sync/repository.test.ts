import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { syncOutboxRepo, syncStateRepo } from './repository'

describe('sync repository', () => {
  beforeEach(async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
  })

  it('enqueues only the latest version for the same entity', async () => {
    await syncOutboxRepo.enqueue('tasks', 'upsert', {
      id: 'task-1',
      title: 'A',
      description: '',
      pinned: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '',
      taskNoteContentJson: null,
      activityLogs: [],
      createdAt: 1,
      updatedAt: 10,
    })
    await syncOutboxRepo.enqueue('tasks', 'upsert', {
      id: 'task-1',
      title: 'B',
      description: '',
      pinned: false,
      status: 'todo',
      priority: null,
      tags: [],
      subtasks: [],
      taskNoteBlocks: [],
      taskNoteContentMd: '',
      taskNoteContentJson: null,
      activityLogs: [],
      createdAt: 1,
      updatedAt: 20,
    })

    const rows = await syncOutboxRepo.listAll()
    expect(rows).toHaveLength(1)
    expect(rows[0].payload).toMatchObject({ title: 'B' })
    expect(rows[0].updatedAt).toBe(20)
  })

  it('creates sync state lazily and patches status', async () => {
    const initial = await syncStateRepo.get()
    expect(initial.status).toBe('idle')
    expect(initial.firstSyncResolved).toBe(false)

    const next = await syncStateRepo.markPendingFirstSync(3, 5)
    expect(next.status).toBe('blocked')
    expect(next.pendingLocalRecordCount).toBe(3)
    expect(next.pendingRemoteRecordCount).toBe(5)
  })
})
