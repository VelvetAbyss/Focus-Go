import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token' }),
}))

vi.mock('./content', () => ({
  encodeSyncPayload: async (_entityType: string, payload: { id: string }) => ({
    payload: { id: payload.id, bodyRefs: { contentMd: `${payload.id}-blob` } },
    blobs: [
      {
        hash: `${payload.id}-blob`,
        contentType: 'text/plain',
        compression: 'gzip',
        rawByteLength: 70_000,
        byteLength: 70_000,
        dataBase64: 'x'.repeat(70_000),
      },
    ],
  }),
}))

import { syncApi } from './client'
import type { SyncOutboxItem } from './types'

const makeOperation = (id: string): SyncOutboxItem<'notes'> => ({
  id: `notes:${id}`,
  entityType: 'notes',
  entityId: id,
  op: 'upsert',
  payload: {
    id,
    title: `Note ${id}`,
    contentMd: '',
    contentJson: null,
    editorMode: 'document',
    collection: 'all-notes',
    tags: [],
    excerpt: '',
    pinned: false,
    wordCount: 0,
    charCount: 0,
    paragraphCount: 0,
    imageCount: 0,
    fileCount: 0,
    headings: [],
    backlinks: [],
    createdAt: 1,
    updatedAt: 1,
  },
  updatedAt: 1,
  attemptCount: 0,
  nextRetryAt: 0,
  createdAt: 0,
})

describe('syncApi.push', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    return db.delete({ disableAutoOpen: false }).then(() => db.open()).then(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ applied: 1, serverTime: 123, missingBlobs: [] }),
    } as Response)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    return db.delete({ disableAutoOpen: false })
  })

  it('splits oversized push payloads into multiple requests', async () => {
    await syncApi.push([makeOperation('1'), makeOperation('2')])

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('negotiates wantBlobs on bootstrap', async () => {
    fetchMock.mockReset()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serverTime: 100,
          tables: { notes: [{ id: 'n1', userId: 'u1', payload: { id: 'n1', bodyRefs: { contentMd: 'blob-1' } }, updatedAt: 1 }], tasks: [], noteTags: [], noteAppearance: [], widgetTodos: [], focusSettings: [], focusSessions: [], diaryEntries: [], spends: [], spendCategories: [], dashboardLayout: [], userSubscriptions: [], featureInstallations: [], projects: [], projectPeople: [], projectNoteLinks: [], habits: [], habitLogs: [], books: [], stocks: [], media: [], lifeSubscriptions: [], lifePodcasts: [], lifePeople: [], trips: [], lifeDashboardLayout: [] },
          blobs: [],
          missingBlobs: ['blob-1'],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serverTime: 101,
          tables: { notes: [], tasks: [], noteTags: [], noteAppearance: [], widgetTodos: [], focusSettings: [], focusSessions: [], diaryEntries: [], spends: [], spendCategories: [], dashboardLayout: [], userSubscriptions: [], featureInstallations: [], projects: [], projectPeople: [], projectNoteLinks: [], habits: [], habitLogs: [], books: [], stocks: [], media: [], lifeSubscriptions: [], lifePodcasts: [], lifePeople: [], trips: [], lifeDashboardLayout: [] },
          blobs: [{ hash: 'blob-1', contentType: 'text/plain', compression: 'gzip', rawByteLength: 1, byteLength: 1, dataBase64: 'eA==' }],
          missingBlobs: [],
        }),
      } as Response)

    const result = await syncApi.bootstrap()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('wantBlobs=blob-1')
    expect(result.blobs).toHaveLength(1)
  })

  it('skips wantBlobs when blob is already cached locally', async () => {
    await db.syncBlobCache.put({
      hash: 'blob-1',
      contentType: 'text/plain',
      compression: 'gzip',
      rawByteLength: 1,
      byteLength: 1,
      dataBase64: 'eA==',
      createdAt: 1,
      updatedAt: 1,
    })

    fetchMock.mockReset()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        serverTime: 100,
        tables: { notes: [{ id: 'n1', userId: 'u1', payload: { id: 'n1', bodyRefs: { contentMd: 'blob-1' } }, updatedAt: 1 }], tasks: [], noteTags: [], noteAppearance: [], widgetTodos: [], focusSettings: [], focusSessions: [], diaryEntries: [], spends: [], spendCategories: [], dashboardLayout: [], userSubscriptions: [], featureInstallations: [], projects: [], projectPeople: [], projectNoteLinks: [], habits: [], habitLogs: [], books: [], stocks: [], media: [], lifeSubscriptions: [], lifePodcasts: [], lifePeople: [], trips: [], lifeDashboardLayout: [] },
        blobs: [],
        missingBlobs: ['blob-1'],
      }),
    } as Response)

    const result = await syncApi.bootstrap()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.blobs).toHaveLength(1)
    expect(result.blobs[0]?.hash).toBe('blob-1')
  })
})
