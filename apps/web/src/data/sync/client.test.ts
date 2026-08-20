import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token' }),
}))

import { syncApi } from './client'

describe('syncApi rxdb endpoints', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    await db.delete({ disableAutoOpen: false })
    await db.open()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    await db.delete({ disableAutoOpen: false })
  })

  it('calls /sync/rxdb/pull and caches returned blobs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        documents: [{ id: 'note-1', updatedAt: 1, _deleted: false }],
        checkpoint: { updatedAt: 1, id: 'note-1' },
        blobs: [{ hash: 'blob-1', contentType: 'text/plain', compression: 'gzip', rawByteLength: 1, byteLength: 1, dataBase64: 'eA==' }],
      }),
    } as Response)

    const response = await syncApi.rxdbPull({
      entityType: 'notes',
      checkpoint: null,
      limit: 100,
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/sync/rxdb/pull')
    expect(response.documents).toHaveLength(1)
    expect(await db.syncBlobCache.get('blob-1')).toBeTruthy()
  })

  it('calls /sync/rxdb/push and caches returned blobs', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        conflicts: [],
        blobs: [{ hash: 'blob-2', contentType: 'text/plain', compression: 'gzip', rawByteLength: 1, byteLength: 1, dataBase64: 'eA==' }],
      }),
    } as Response)

    await syncApi.rxdbPush({
      entityType: 'tasks',
      rows: [{
        newDocumentState: { id: 'task-1', updatedAt: 1, createdAt: 1, title: 'Task', description: '', pinned: false, isToday: false, status: 'todo', priority: null, tags: [], subtasks: [], taskNoteBlocks: [], taskNoteContentMd: '', taskNoteContentJson: null, activityLogs: [] },
        assumedMasterState: null,
      }],
      blobs: [],
    })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/sync/rxdb/push')
    expect(await db.syncBlobCache.get('blob-2')).toBeTruthy()
  })

  it('maps network fetch failures to a sync server error', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Missing Bearer token' }),
      } as Response)

    await expect(syncApi.rxdbPull({
      entityType: 'notes',
      checkpoint: null,
      limit: 100,
    })).rejects.toThrow(/Sync auth token invalid or expired/)
  })
})
