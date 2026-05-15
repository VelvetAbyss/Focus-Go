import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { enqueueSyncOperation } from './repository'
import '../events/timelineProjection'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token' }),
}))

vi.mock('./content', () => ({
  createBlobMap: (blobs: Array<{ hash: string }>) => new Map(blobs.map((blob) => [blob.hash, blob])),
  encodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => ({ payload, blobs: [] }),
  decodeSyncPayload: async (_entityType: string, payload: Record<string, unknown>) => payload,
}))

import { ensureRxdbSyncReady, resetRxdbSyncDatabase, runRxdbSyncCycle } from './rxdb'

describe('rxdb sync migration', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(async () => {
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
    await db.open()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    await resetRxdbSyncDatabase()
    await db.delete({ disableAutoOpen: false })
  })

  it('migrates existing Dexie rows into RxDB and pushes them through the new endpoint', async () => {
    await db.tasks.put({
      id: 'task-local',
      title: 'Local task',
      description: '',
      pinned: false,
      isToday: false,
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

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    const pushCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/sync/rxdb/push'))
    expect(pushCall).toBeTruthy()
    const body = JSON.parse(String(pushCall?.[1]?.body ?? '{}'))
    expect(body.entityType).toBe('tasks')
    expect(body.rows[0].newDocumentState.id).toBe('task-local')
  })

  it('pulls remote rows through the new endpoint and writes them back to Dexie tables', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'note-remote',
              title: 'Remote note',
              contentMd: 'body',
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
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'note-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.notes.get('note-remote'))?.title).toBe('Remote note')
  })

  it('syncs domainEvents and projects pulled events into local timeline items', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'domainEvents') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'event-remote',
              type: 'task.completed',
              actorId: null,
              workspaceId: null,
              occurredAt: 20,
              source: { kind: 'user' },
              subject: { domain: 'productivity', type: 'task', id: 'task-remote' },
              subjectKey: 'task:task-remote',
              related: [],
              payload: { title: 'Remote task', previousStatus: 'doing', completedAt: 20 },
              schemaVersion: 1,
              dedupeKey: 'task.completed:task-remote:20',
              createdAt: 20,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'event-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.domainEvents.get('event-remote'))?.dedupeKey).toBe('task.completed:task-remote:20')
    expect((await db.timelineItems.get('tl_event-remote'))?.summary).toBe('Remote task')
  })

  it('uses only rxdb endpoints during migration sync', async () => {
    await db.projects.put({
      id: 'project-local',
      title: 'Local project',
      description: '',
      goal: '',
      status: 'active',
      priority: null,
      health: 'on-track',
      progress: 0,
      createdAt: 1,
      updatedAt: 10,
    })

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (!url.includes('/sync/rxdb/')) throw new Error(`legacy sync endpoint called: ${url}`)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'projects') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'project-remote',
              title: 'Remote project',
              description: '',
              goal: '',
              status: 'active',
              priority: null,
              health: 'on-track',
              progress: 0,
              createdAt: 2,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: { updatedAt: 20, id: 'project-remote' },
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await ensureRxdbSyncReady()
    await runRxdbSyncCycle()

    expect((await db.projects.get('project-local'))?.title).toBe('Local project')
    expect((await db.projects.get('project-remote'))?.title).toBe('Remote project')
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('/sync/rxdb/'))).toBe(true)
    expect(fetchMock.mock.calls.some(([, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return body.entityType === 'timelineItems'
    })).toBe(false)
  })

  it('pushes deletes as tombstones with deletedAt', async () => {
    const deletedAt = 1234
    await enqueueSyncOperation('projects', 'delete', { id: 'project-deleted', updatedAt: deletedAt, title: 'Deleted' }, deletedAt)

    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await runRxdbSyncCycle()

    const pushCall = fetchMock.mock.calls.find(([url, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      return String(url).includes('/sync/rxdb/push') && body.entityType === 'projects'
    })
    const body = JSON.parse(String(pushCall?.[1]?.body ?? '{}'))
    expect(body.rows[0].newDocumentState).toMatchObject({
      id: 'project-deleted',
      _deleted: true,
      deletedAt,
      updatedAt: deletedAt,
    })
  })

  it('blocks malformed remote payloads before writing to Dexie', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'notes') {
        return {
          ok: true,
          json: async () => ({
            documents: [{ id: 'note-bad', title: 'Bad', updatedAt: 'bad', _deleted: false }],
            checkpoint: null,
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await expect(runRxdbSyncCycle()).rejects.toThrow(/notes: pull returned invalid updatedAt/)
    expect(await db.notes.get('note-bad')).toBeUndefined()
    expect((await db.syncState.get('cloud-sync'))?.lastError).toContain('notes: pull returned invalid updatedAt')
  }, 15_000)

  it('blocks malformed remote domainEvents before writing to Dexie', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      if (url.includes('/sync/rxdb/pull') && body.entityType === 'domainEvents') {
        return {
          ok: true,
          json: async () => ({
            documents: [{
              id: 'event-bad',
              type: 'task.completed',
              occurredAt: 20,
              updatedAt: 20,
              _deleted: false,
            }],
            checkpoint: null,
            blobs: [],
          }),
        } as Response
      }
      if (url.includes('/sync/rxdb/pull')) {
        return {
          ok: true,
          json: async () => ({ documents: [], checkpoint: body.checkpoint ?? null, blobs: [] }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({ conflicts: [], blobs: [] }),
      } as Response
    })

    await expect(runRxdbSyncCycle()).rejects.toThrow(/domainEvents: pull returned invalid dedupeKey/)
    expect(await db.domainEvents.get('event-bad')).toBeUndefined()
  }, 15_000)
})
