import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
const auth = vi.hoisted(() => ({ accountId: 'account-a' }))

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token', user: { id: auth.accountId } }),
}))

import { syncApi } from './client'
import type { RxdbPushRequest, RxdbPushResponse, SyncWireBlob } from './types'

describe('syncApi rxdb endpoints', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    auth.accountId = 'account-a'
    await db.delete({ disableAutoOpen: false })
    await db.open()
    vi.stubGlobal('fetch', fetchMock)
  })

  it.each(['pull', 'push'] as const)('discards an in-flight %s response after account switching before caching its blobs', async (kind) => {
    let complete: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const pending = kind === 'pull'
      ? syncApi.rxdbPull({ entityType: 'notes', checkpoint: null, limit: 100 })
      : syncApi.rxdbPush({ entityType: 'notes', rows: [], blobs: [] })
    auth.accountId = 'account-b'
    complete({ ok: true, json: async () => ({ documents: [], conflicts: [], blobs: [{ hash: 'account-a-private', dataBase64: 'eA==' }] }) } as Response)
    await expect(pending).rejects.toThrow('Sync account changed')
    expect(await db.syncBlobCache.count()).toBe(0)
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
    })).rejects.toThrow(/Sync request blocked by browser or network/)
  })
})

describe('sync upload size recovery', () => {
  const calls: Array<{ path: string; body: RxdbPushRequest & { dataBase64: string; offset: number }; bytes: number }> = []
  const ok = (body: Pick<RxdbPushResponse, 'conflicts' | 'blobs'> & { quota: { usedBytes: number; limitBytes: number } } = { conflicts: [], blobs: [], quota: { usedBytes: 1, limitBytes: 100 } }) => new Response(JSON.stringify(body))
  const row = (id: string, hash?: string) => ({ newDocumentState: { id, title: id, createdAt: 1, updatedAt: 1, ...(hash ? { bodyRefs: { contentMd: hash } } : {}) }, assumedMasterState: null })
  const request = (rows: ReturnType<typeof row>[], blobs: SyncWireBlob[] = []) => ({ entityType: 'notes', rows, blobs }) as unknown as Parameters<typeof syncApi.rxdbPush>[0]
  const blob = (hash: string, size: number): SyncWireBlob => ({ hash, contentType: 'text/plain', compression: 'none', rawByteLength: size * 3 / 4, byteLength: size * 3 / 4, dataBase64: 'a'.repeat(size) })
  beforeEach(async () => {
    calls.length = 0
    auth.accountId = 'account-a'
    await db.delete({ disableAutoOpen: false }); await db.open()
    vi.stubGlobal('fetch', vi.fn(async (path, init) => {
      calls.push({ path: String(path), body: JSON.parse(String(init.body)), bytes: new TextEncoder().encode(String(init.body)).length })
      if (String(path).endsWith('/blobs/known')) return new Response(JSON.stringify({ hashes: [] }))
      if (String(path).endsWith('/blobs/chunk')) {
        const body = JSON.parse(String(init.body))
        const received = body.offset + body.dataBase64.length
        return new Response(JSON.stringify({ received, complete: received === body.totalLength }))
      }
      return ok()
    }))
  })
  afterEach(async () => { vi.unstubAllGlobals(); await db.delete({ disableAutoOpen: false }) })

  it('splits batches by encoded bytes and keeps each row’s new and assumed blob references', async () => {
    const rows = [row('one', 'a'), row('two', 'b'), row('three', 'c')]
    Object.assign(rows[1], { assumedMasterState: { id: 'two', bodyRefs: { contentMd: 'old' } } })
    await syncApi.rxdbPush(request(rows, ['a', 'b', 'c', 'old'].map(hash => blob(hash, 260_000))))
    const pushes = calls.filter(call => call.path.endsWith('/rxdb/push'))
    expect(pushes).toHaveLength(3)
    expect(pushes[1].body.blobs.map((b: SyncWireBlob) => b.hash)).toEqual(['b', 'old'])
    expect(calls.every(call => call.bytes < 524288)).toBe(true)
  })

  it('uploads one large blob in bounded chunks before publishing its row', async () => {
    await syncApi.rxdbPush(request([row('large', 'big')], [blob('big', 1_200_000)]))
    const chunks = calls.filter(call => call.path.endsWith('/blobs/chunk'))
    expect(chunks).toHaveLength(5)
    expect(chunks.map(call => call.body.dataBase64).join('')).toBe('a'.repeat(1_200_000))
    expect(chunks.map(call => call.body.offset)).toEqual([0, 262144, 524288, 786432, 1048576])
    expect(calls.at(-1)?.body.rows[0].newDocumentState.id).toBe('large')
    expect(calls.at(-1)?.body.blobs).toEqual([])
    expect(calls.every(call => call.bytes < 524288)).toBe(true)
  })

  it('shrinks a rejected batch after an HTML 413 and combines conflicts', async () => {
    let count = 0
    vi.stubGlobal('fetch', vi.fn(async (_path, init) => {
      const body = JSON.parse(String(init.body)); count++
      if (body.rows.length > 1) return new Response('<html>too large</html>', { status: 413 })
      return ok({ conflicts: [body.rows[0].newDocumentState], blobs: [], quota: { usedBytes: count, limitBytes: 100 } })
    }))
    const result = await syncApi.rxdbPush(request([row('one'), row('two')]))
    expect(result.conflicts.map(r => r.id)).toEqual(['one', 'two'])
    expect(count).toBe(3)
  })

  it('does not retry or hide a genuine storage quota error', async () => {
    const mock = vi.fn(async () => new Response(JSON.stringify({ error: 'cloud_storage_quota_exceeded', usedBytes: 101, limitBytes: 100 }), { status: 413 }))
    vi.stubGlobal('fetch', mock)
    await expect(syncApi.rxdbPush(request([row('one'), row('two')]))).rejects.toThrow('101 / 100')
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('stops before publishing when a chunk fails', async () => {
    const mock = vi.fn<typeof fetch>(async path => String(path).endsWith('/blobs/known') ? new Response(JSON.stringify({ hashes: [] })) : new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', mock)
    await expect(syncApi.rxdbPush(request([row('large', 'big')], [blob('big', 1_200_000)]))).rejects.toThrow('500')
    expect(mock).toHaveBeenCalledTimes(2)
    expect(String(mock.mock.calls[1]?.[0])).toContain('/blobs/chunk')
  })

  it('stops all remaining chunks after the account changes', async () => {
    const mock = vi.fn(async () => { auth.accountId = 'account-b'; return ok() })
    vi.stubGlobal('fetch', mock)
    await expect(syncApi.rxdbPush(request([row('large', 'big')], [blob('big', 1_200_000)]))).rejects.toThrow('Sync account changed')
    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('bounds retries for oversized metadata and names the retained record', async () => {
    const mock = vi.fn(async () => new Response('too large', { status: 413 }))
    vi.stubGlobal('fetch', mock)
    await expect(syncApi.rxdbPush(request([row('large-record')]))).rejects.toThrow('large-record')
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('reuses already owned large content without uploading it again', async () => {
    const mock = vi.fn<typeof fetch>(async (path, init) => {
      if (String(path).endsWith('/blobs/known')) return Response.json({ hashes: ['owned'] })
      const body = JSON.parse(String(init?.body))
      expect(body.blobs).toEqual([])
      return ok()
    })
    vi.stubGlobal('fetch', mock)
    await syncApi.rxdbPush(request([row('metadata-edit', 'owned')], [blob('owned', 800_000)]))
    expect(mock).toHaveBeenCalledTimes(2)
    expect(mock.mock.calls.some(([path]) => String(path).endsWith('/blobs/chunk'))).toBe(false)
  })

  it('keeps progressing across 120-push-per-minute windows after partial success', async () => {
    const owned = new Set<string>()
    const staged = new Map<string, number>()
    const saved = new Set<string>()
    let pushes = 0
    let windowIndex = 0
    const chunksPerWindow: number[] = [0, 0, 0]
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (path, init) => {
      const body = JSON.parse(String(init?.body))
      if (String(path).endsWith('/blobs/known')) return Response.json({ hashes: body.hashes.filter((hash: string) => owned.has(hash) || staged.get(hash) === 1_200_000) })
      if (++pushes > 120) return Response.json({ error: 'sync_rate_limited', retryAfterSeconds: 60 }, { status: 429 })
      if (String(path).endsWith('/blobs/chunk')) {
        chunksPerWindow[windowIndex]++
        const received = Math.max(staged.get(body.blob.hash) ?? 0, body.offset + body.dataBase64.length)
        staged.set(body.blob.hash, received)
        return Response.json({ received, complete: received === body.totalLength })
      }
      for (const item of body.rows) {
        const hash = item.newDocumentState.bodyRefs.contentMd
        expect(owned.has(hash) || staged.get(hash) === 1_200_000).toBe(true)
        owned.add(hash); staged.delete(hash); saved.add(item.newDocumentState.id)
      }
      return ok()
    }))
    const items = Array.from({ length: 30 }, (_, index) => row(`row-${index}`, `hash-${index}`))
    const batch = request(items, items.map((_, index) => blob(`hash-${index}`, 1_200_000)))
    await expect(syncApi.rxdbPush(batch)).rejects.toThrow('429')
    expect(saved.size).toBe(20)
    expect(chunksPerWindow[0]).toBe(100)
    pushes = 0; windowIndex++
    await syncApi.rxdbPush(batch)
    expect(saved.size).toBe(30)
    expect(chunksPerWindow[1]).toBe(50)
    expect(pushes).toBeLessThanOrEqual(120)
  }, 15_000)

  it('never reports success for oversized blob-only requests that cannot publish references', async () => {
    const mock = vi.fn<typeof fetch>(async () => new Response('too large', { status: 413 }))
    vi.stubGlobal('fetch', mock)
    await expect(syncApi.rxdbPush(request([], [blob('orphan', 1_200_000)]))).rejects.toThrow('Blob-only sync request too large')
    expect(mock).toHaveBeenCalledTimes(1)
  })

})
